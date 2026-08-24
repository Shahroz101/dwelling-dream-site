#!/usr/bin/env python3
import base64
import hashlib
import json
import os
import random
import re
import socketserver
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote, parse_qs

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
UPLOADS_DIR = DATA_DIR / "uploads"  # legacy local-disk fallback for the /uploads/ route only
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    ADMIN_PASSWORD = os.urandom(9).hex()
    print(f"No ADMIN_PASSWORD set - generated one for this run: {ADMIN_PASSWORD}")
    print("Set ADMIN_USERNAME/ADMIN_PASSWORD env vars to use a fixed login instead.")
PORT = int(os.environ.get("PORT", "3000"))
SESSIONS = {}

# Products, orders, product images, and digital files all live in Supabase
# (Postgres via PostgREST for the records, Storage for the actual image/file
# bytes) - nothing persists on local disk, so a redeploy can never wipe
# anything a store owner has added through the admin panel.
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise SystemExit(
        "SUPABASE_URL and SUPABASE_SERVICE_KEY env vars are required "
        "(Project Settings -> API in the Supabase dashboard)."
    )
IMAGES_BUCKET = "product-images"
DIGITAL_BUCKET = "digital-files"

DOWNLOAD_MIME_TYPES = {
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".epub": "application/epub+zip",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def ensure_storage():
    pass


def supabase_storage_upload(bucket, object_path, content, content_type):
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{object_path}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": content_type or "application/octet-stream",
    }
    req = urllib.request.Request(url, data=content, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase Storage upload to {bucket}/{object_path} failed: {exc.code} {detail}")


def supabase_storage_download(bucket, object_path):
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{object_path}"
    headers = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}
    req = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def supabase_storage_delete(bucket, object_path):
    if not object_path:
        return
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{object_path}"
    headers = {"apikey": SUPABASE_SERVICE_KEY, "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}
    req = urllib.request.Request(url, headers=headers, method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp.read()
    except Exception:
        pass  # best-effort cleanup - a missing/already-gone object is not an error


def supabase_public_url(bucket, object_path):
    return f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/{object_path}"


def storage_object_key(url, bucket):
    prefix = f"{SUPABASE_URL}/storage/v1/object/public/{bucket}/"
    if isinstance(url, str) and url.startswith(prefix):
        return url[len(prefix):]
    return None


def supabase_request(path_and_query, method="GET", body=None):
    url = f"{SUPABASE_URL}/rest/v1/{path_and_query}"
    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {method} {path_and_query} failed: {exc.code} {detail}")


def row_to_product(row):
    return {
        "id": row["id"],
        "sku": row["sku"],
        "title": row["title"],
        "description": row["description"],
        "category": row["category"],
        "price": float(row["price"]),
        "images": row.get("images") or [],
        "digitalFiles": row.get("digital_files") or [],
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def read_products():
    rows = supabase_request("products?select=*&order=created_at.desc") or []
    return [row_to_product(row) for row in rows]


def get_product_by_id(product_id):
    rows = supabase_request(f"products?id=eq.{product_id}&select=*") or []
    return row_to_product(rows[0]) if rows else None


def insert_product(product):
    row = {
        "id": product["id"],
        "sku": product["sku"],
        "title": product["title"],
        "description": product["description"],
        "category": product["category"],
        "price": product["price"],
        "images": product["images"],
        "digital_files": product["digitalFiles"],
        "created_at": product["createdAt"],
        "updated_at": product["createdAt"],
    }
    rows = supabase_request("products", "POST", body=row)
    return row_to_product(rows[0])


def update_product(product_id, patch):
    rows = supabase_request(f"products?id=eq.{product_id}", "PATCH", body=patch)
    return row_to_product(rows[0]) if rows else None


def delete_product_row(product_id):
    supabase_request(f"products?id=eq.{product_id}", "DELETE")


def row_to_order(row):
    return {
        "id": row["id"],
        "token": row["token"],
        "items": row.get("items") or [],
        "total": float(row["total"]),
        "paid": bool(row["paid"]),
        "createdAt": row.get("created_at"),
    }


def insert_order(order):
    row = {
        "id": order["id"],
        "token": order["token"],
        "items": order["items"],
        "total": order["total"],
        "paid": order["paid"],
        "created_at": order["createdAt"],
    }
    rows = supabase_request("orders", "POST", body=row)
    return row_to_order(rows[0])


def delete_product_by_id(product_id):
    product = get_product_by_id(product_id)
    if not product:
        return False

    delete_product_row(product_id)

    for image_path in product.get("images", []):
        key = storage_object_key(image_path, IMAGES_BUCKET)
        if key:
            supabase_storage_delete(IMAGES_BUCKET, key)

    for digital_file in product.get("digitalFiles", []):
        stored_name = digital_file.get("storedName") if isinstance(digital_file, dict) else None
        if stored_name:
            supabase_storage_delete(DIGITAL_BUCKET, stored_name)

    return True


def parse_cookies(cookie_header):
    cookies = {}
    if not cookie_header:
        return cookies
    for item in cookie_header.split(";"):
        key, _, value = item.partition("=")
        if key:
            cookies[key.strip()] = value.strip()
    return cookies


def is_authorized(handler):
    auth_header = handler.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "", 1).strip()
        if token and token in SESSIONS:
            return True

    cookies = parse_cookies(handler.headers.get("Cookie", ""))
    token = cookies.get("session")
    return bool(token and token in SESSIONS)


def generate_sku(title, category):
    clean_title = re.sub(r"[^A-Z0-9]+", "-", (title or "PRODUCT").upper()).strip("-")[:4] or "PRD"
    clean_category = re.sub(r"[^A-Z0-9]+", "-", (category or "GENERAL").upper()).strip("-")[:4] or "GEN"
    unique = random.randint(1000, 9999)
    return f"{clean_category}-{clean_title}-{unique}"


def save_base64_image(value, sku):
    if not isinstance(value, str) or not value.startswith("data:image/"):
        return None
    match = re.match(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", value)
    if not match:
        return None
    mime_type, encoded = match.groups()
    ext = ".jpg"
    if "png" in mime_type:
        ext = ".png"
    elif "webp" in mime_type:
        ext = ".webp"
    elif "gif" in mime_type:
        ext = ".gif"
    file_id = os.urandom(8).hex()
    file_name = f"{sku}-{file_id}{ext}"
    content = base64.b64decode(encoded)
    supabase_storage_upload(IMAGES_BUCKET, file_name, content, mime_type)
    return supabase_public_url(IMAGES_BUCKET, file_name)


def save_base64_file(value, original_name, sku):
    if not isinstance(value, str):
        return None
    match = re.match(r"^data:([^;]+);base64,(.+)$", value)
    if not match:
        return None
    mime_type, encoded = match.groups()

    ext = ""
    if original_name and "." in original_name:
        ext = "." + re.sub(r"[^a-z0-9]", "", original_name.rsplit(".", 1)[-1].lower())
    if not ext:
        ext = {
            "application/pdf": ".pdf",
            "application/zip": ".zip",
            "application/epub+zip": ".epub",
        }.get(mime_type, ".bin")

    try:
        raw = base64.b64decode(encoded)
    except Exception:
        return None

    file_id = os.urandom(8).hex()
    stored_name = f"{sku}-{file_id}{ext}"
    supabase_storage_upload(DIGITAL_BUCKET, stored_name, raw, mime_type)
    return {
        "id": file_id,
        "name": (original_name or stored_name).strip() or stored_name,
        "size": len(raw),
        "storedName": stored_name,
    }


def send_json(handler, status, payload):
    data = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


def serve_file(handler, file_path):
    try:
        content = file_path.read_bytes()
        mime_type = "text/html; charset=utf-8"
        if file_path.suffix.lower() == ".css":
            mime_type = "text/css; charset=utf-8"
        elif file_path.suffix.lower() == ".js":
            mime_type = "application/javascript; charset=utf-8"
        elif file_path.suffix.lower() == ".json":
            mime_type = "application/json; charset=utf-8"
        elif file_path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"}:
            mime_type = {
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".gif": "image/gif",
                ".webp": "image/webp",
                ".svg": "image/svg+xml",
                ".ico": "image/x-icon",
            }.get(file_path.suffix.lower(), "application/octet-stream")

        handler.send_response(200)
        handler.send_header("Content-Type", mime_type)
        handler.send_header("Cache-Control", "no-store")
        handler.send_header("Content-Length", str(len(content)))
        handler.end_headers()
        handler.wfile.write(content)
    except FileNotFoundError:
        handler.send_response(404)
        handler.send_header("Content-Type", "text/plain; charset=utf-8")
        handler.end_headers()
        handler.wfile.write(b"Not found")


def serve_download_bytes(handler, content, stored_name, download_name):
    suffix = ("." + stored_name.rsplit(".", 1)[-1].lower()) if "." in stored_name else ""
    mime_type = DOWNLOAD_MIME_TYPES.get(suffix, "application/octet-stream")
    safe_name = re.sub(r'[\r\n"]', "", download_name or stored_name)

    handler.send_response(200)
    handler.send_header("Content-Type", mime_type)
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Disposition", f'attachment; filename="{safe_name}"')
    handler.send_header("Content-Length", str(len(content)))
    handler.end_headers()
    handler.wfile.write(content)


def find_order(order_id, token):
    rows = supabase_request(f"orders?id=eq.{order_id}&select=*") or []
    if not rows:
        return None
    row = rows[0]
    if row.get("token") != token:
        return None
    return row_to_order(row)


class AdminHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_HEAD(self):
        # Handle HEAD requests same as GET
        self.do_GET()

    def do_GET(self):
        url = urlparse(self.path)
        path = unquote(url.path)  # Decode URL-encoded characters like %20 to spaces

        if path.startswith("/uploads/"):
            relative = path.removeprefix("/uploads/")
            target = (UPLOADS_DIR / relative).resolve()
            if str(target).startswith(str(UPLOADS_DIR.resolve())) and target.exists() and target.is_file():
                serve_file(self, target)
                return
            self.send_response(403)
            self.end_headers()
            return

        if path == "/":
            serve_file(self, ROOT / "Dwelling Dream Homepage v2.dc.html")
            return

        if path == "/login.html":
            serve_file(self, ROOT / "login.html")
            return

        if path in {"/admin", "/admin.html"}:
            if not is_authorized(self):
                self.send_response(302)
                self.send_header("Location", "/login.html")
                self.end_headers()
                return
            serve_file(self, ROOT / "admin.html")
            return

        # Serve the main pages
        if path == "/palettes" or path == "/Dwelling Dream Palettes.dc.html":
            serve_file(self, ROOT / "Dwelling Dream Palettes.dc.html")
            return

        if path == "/api/products":
            # GET is public - allow anyone to view the catalog. Never expose the
            # internal storedName (the real on-disk filename) for digital files -
            # downloads only ever happen through the token-gated /api/download route.
            try:
                fetched_products = read_products()
            except RuntimeError as exc:
                send_json(self, 500, {"success": False, "message": "Failed to reach the product database.", "error": str(exc)})
                return
            public_products = []
            for product in fetched_products:
                public_product = dict(product)
                public_product["digitalFiles"] = [
                    {"id": f.get("id"), "name": f.get("name"), "size": f.get("size", 0)}
                    for f in product.get("digitalFiles", [])
                    if isinstance(f, dict)
                ]
                public_products.append(public_product)
            send_json(self, 200, {"products": public_products})
            return

        if path.startswith("/api/orders/"):
            # Public, but gated by the per-order token issued at checkout time.
            order_id = path.removeprefix("/api/orders/")
            query = parse_qs(url.query)
            token = (query.get("token") or [""])[0]
            try:
                order = find_order(order_id, token)
            except RuntimeError as exc:
                send_json(self, 500, {"success": False, "message": "Failed to reach the order database.", "error": str(exc)})
                return
            if not order:
                send_json(self, 404, {"success": False, "message": "Order not found."})
                return
            send_json(self, 200, {"success": True, "order": order})
            return

        if path == "/api/download":
            query = parse_qs(url.query)
            order_id = (query.get("order") or [""])[0]
            token = (query.get("token") or [""])[0]
            file_id = (query.get("file") or [""])[0]

            try:
                order = find_order(order_id, token)
            except RuntimeError as exc:
                send_json(self, 500, {"success": False, "message": "Failed to reach the order database.", "error": str(exc)})
                return
            if not order or not order.get("paid"):
                send_json(self, 403, {"success": False, "message": "This download link is invalid or the order hasn't been paid."})
                return

            purchased_file_ids = {
                digital_file.get("id")
                for item in order.get("items", [])
                for digital_file in item.get("digitalFiles", [])
            }
            if file_id not in purchased_file_ids:
                send_json(self, 404, {"success": False, "message": "File not found in this order."})
                return

            try:
                products = read_products()
            except RuntimeError as exc:
                send_json(self, 500, {"success": False, "message": "Failed to reach the product database.", "error": str(exc)})
                return
            stored_name = None
            display_name = None
            for product in products:
                for digital_file in product.get("digitalFiles", []):
                    if digital_file.get("id") == file_id:
                        stored_name = digital_file.get("storedName")
                        display_name = digital_file.get("name")
                        break
                if stored_name:
                    break

            if stored_name:
                try:
                    content = supabase_storage_download(DIGITAL_BUCKET, stored_name)
                except urllib.error.HTTPError:
                    content = None
                if content is not None:
                    serve_download_bytes(self, content, stored_name, display_name)
                    return

            send_json(self, 404, {"success": False, "message": "This file is no longer available."})
            return

        # Serve other HTML/CSS/JS files from root
        if path.endswith((".html", ".css", ".js", ".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg")):
            file_path = ROOT / path.lstrip("/")
            if file_path.exists() and file_path.is_file():
                serve_file(self, file_path)
                return

        self.send_response(404)
        self.end_headers()

    def do_DELETE(self):
        url = urlparse(self.path)
        path = url.path

        if path != "/api/products":
            self.send_response(404)
            self.end_headers()
            return

        if not is_authorized(self):
            send_json(self, 401, {"success": False, "message": "Unauthorized access."})
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length).decode("utf-8")
        try:
            payload = json.loads(body or "{}")
        except Exception:
            send_json(self, 400, {"success": False, "message": "Invalid request body."})
            return

        product_id = str(payload.get("id", "")).strip()
        if not product_id:
            send_json(self, 400, {"success": False, "message": "Product ID is required."})
            return

        try:
            deleted = delete_product_by_id(product_id)
        except RuntimeError as exc:
            send_json(self, 500, {"success": False, "message": "Failed to delete product.", "error": str(exc)})
            return
        if not deleted:
            send_json(self, 404, {"success": False, "message": "Product not found."})
            return

        send_json(self, 200, {"success": True, "message": "Product deleted successfully."})

    def do_PUT(self):
        url = urlparse(self.path)
        path = url.path

        if path != "/api/products":
            self.send_response(404)
            self.end_headers()
            return

        if not is_authorized(self):
            send_json(self, 401, {"success": False, "message": "Unauthorized access."})
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length).decode("utf-8")
        try:
            payload = json.loads(body or "{}")
        except Exception:
            send_json(self, 400, {"success": False, "message": "Invalid request body."})
            return

        product_id = str(payload.get("id", "")).strip()
        if not product_id:
            send_json(self, 400, {"success": False, "message": "Product ID is required."})
            return

        try:
            existing = get_product_by_id(product_id)
        except RuntimeError as exc:
            send_json(self, 500, {"success": False, "message": "Failed to reach the product database.", "error": str(exc)})
            return
        if existing is None:
            send_json(self, 404, {"success": False, "message": "Product not found."})
            return

        title = str(payload.get("title", "")).strip()
        description = str(payload.get("description", "")).strip()
        category = str(payload.get("category", "")).strip()
        price = float(payload.get("price") or 0)
        valid_categories = {"Behr", "Sherwin Williams", "Benjamin Moore"}

        if not title or not description or not category or price <= 0:
            send_json(self, 400, {"success": False, "message": "Title, description, category, and price are required."})
            return

        if category not in valid_categories:
            send_json(self, 400, {"success": False, "message": "Category must be Behr, Sherwin Williams, or Benjamin Moore."})
            return

        keep_images = payload.get("keepImages") if isinstance(payload.get("keepImages"), list) else []
        new_images_raw = payload.get("newImages") if isinstance(payload.get("newImages"), list) else []
        keep_digital_ids = set(
            payload.get("keepDigitalFiles") if isinstance(payload.get("keepDigitalFiles"), list) else []
        )
        new_digital_raw = payload.get("newDigitalFiles") if isinstance(payload.get("newDigitalFiles"), list) else []

        sku = existing.get("sku") or generate_sku(title, category)

        # Save any newly-uploaded files first, so we know the true final counts
        # before touching anything that's already on disk.
        saved_new_images = []
        for image in new_images_raw:
            saved_path = save_base64_image(image, sku)
            if saved_path:
                saved_new_images.append(saved_path)

        saved_new_digital = []
        for entry in new_digital_raw:
            if not isinstance(entry, dict):
                continue
            saved = save_base64_file(entry.get("data"), entry.get("name"), sku)
            if saved:
                saved_new_digital.append(saved)

        final_images = [img for img in existing.get("images", []) if img in keep_images] + saved_new_images
        final_digital = [
            f for f in existing.get("digitalFiles", []) if f.get("id") in keep_digital_ids
        ] + saved_new_digital

        if not final_images:
            # Reject the edit without touching the product's existing files - only
            # clean up whatever we just wrote for this rejected attempt.
            for image_path in saved_new_images:
                key = storage_object_key(image_path, IMAGES_BUCKET)
                if key:
                    supabase_storage_delete(IMAGES_BUCKET, key)
            for digital_file in saved_new_digital:
                supabase_storage_delete(DIGITAL_BUCKET, digital_file["storedName"])
            send_json(self, 400, {"success": False, "message": "At least one product image is required."})
            return

        updated_at = now_iso()
        patch = {
            "title": title,
            "description": description,
            "category": category,
            "price": price,
            "images": final_images,
            "digital_files": final_digital,
            "updated_at": updated_at,
        }
        try:
            update_product(product_id, patch)
        except RuntimeError as exc:
            send_json(self, 500, {"success": False, "message": "Failed to update product.", "error": str(exc)})
            return

        # Only remove whatever was dropped from the "keep" lists after the
        # database write succeeds, so a failed update never orphans files.
        for image_path in existing.get("images", []):
            if image_path in keep_images:
                continue
            key = storage_object_key(image_path, IMAGES_BUCKET)
            if key:
                supabase_storage_delete(IMAGES_BUCKET, key)

        for digital_file in existing.get("digitalFiles", []):
            if digital_file.get("id") in keep_digital_ids:
                continue
            stored_name = digital_file.get("storedName")
            if stored_name:
                supabase_storage_delete(DIGITAL_BUCKET, stored_name)

        updated_product = {**existing, "title": title, "description": description, "category": category,
                            "price": price, "images": final_images, "digitalFiles": final_digital, "updatedAt": updated_at}
        send_json(self, 200, {"success": True, "message": "Product updated successfully.", "product": updated_product})

    def do_POST(self):
        url = urlparse(self.path)
        path = url.path

        if path == "/api/login":
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                payload = json.loads(body or "{}")
            except Exception:
                send_json(self, 400, {"success": False, "message": "Invalid request body."})
                return

            username = str(payload.get("username", "")).strip()
            password = str(payload.get("password", "")).strip()
            if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
                send_json(self, 401, {"success": False, "message": "Invalid username or password."})
                return

            token = os.urandom(24).hex()
            SESSIONS[token] = {"username": username}
            response_body = json.dumps({
                "success": True,
                "message": "Login successful.",
                "sessionToken": token
            }).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Set-Cookie", f"session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400")
            self.send_header("Content-Length", str(len(response_body)))
            self.end_headers()
            self.wfile.write(response_body)
            return

        if path == "/api/logout":
            cookies = parse_cookies(self.headers.get("Cookie", ""))
            session = cookies.get("session")
            auth_header = self.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                session = auth_header.replace("Bearer ", "", 1).strip() or session
            if session:
                SESSIONS.pop(session, None)
            response_body = json.dumps({"success": True, "message": "Logged out."}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Set-Cookie", "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")
            self.send_header("Content-Length", str(len(response_body)))
            self.end_headers()
            self.wfile.write(response_body)
            return

        if path == "/api/products":
            if not is_authorized(self):
                send_json(self, 401, {"success": False, "message": "Unauthorized access."})
                return

            if self.command == "DELETE":
                content_length = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(content_length).decode("utf-8")
                try:
                    payload = json.loads(body or "{}")
                except Exception:
                    send_json(self, 400, {"success": False, "message": "Invalid request body."})
                    return

                product_id = str(payload.get("id", "")).strip()
                if not product_id:
                    send_json(self, 400, {"success": False, "message": "Product ID is required."})
                    return

                deleted = delete_product_by_id(product_id)
                if not deleted:
                    send_json(self, 404, {"success": False, "message": "Product not found."})
                    return

                send_json(self, 200, {"success": True, "message": "Product deleted successfully."})
                return

            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                payload = json.loads(body or "{}")
            except Exception:
                send_json(self, 400, {"success": False, "message": "Invalid request body."})
                return

            title = str(payload.get("title", "")).strip()
            description = str(payload.get("description", "")).strip()
            category = str(payload.get("category", "")).strip()
            price = float(payload.get("price") or 0)
            images = payload.get("images") if isinstance(payload.get("images"), list) else []
            digital_files_raw = payload.get("digitalFiles") if isinstance(payload.get("digitalFiles"), list) else []
            valid_categories = {"Behr", "Sherwin Williams", "Benjamin Moore"}

            if not title or not description or not category or price <= 0:
                send_json(self, 400, {"success": False, "message": "Title, description, category, and price are required."})
                return

            if category not in valid_categories:
                send_json(self, 400, {"success": False, "message": "Category must be Behr, Sherwin Williams, or Benjamin Moore."})
                return

            if not images:
                send_json(self, 400, {"success": False, "message": "At least one product image is required."})
                return

            sku = generate_sku(title, category)
            saved_images = []
            for image in images:
                saved_path = save_base64_image(image, sku)
                if saved_path:
                    saved_images.append(saved_path)

            if not saved_images:
                send_json(self, 400, {"success": False, "message": "The uploaded files could not be processed as images."})
                return

            saved_digital_files = []
            for entry in digital_files_raw:
                if not isinstance(entry, dict):
                    continue
                saved = save_base64_file(entry.get("data"), entry.get("name"), sku)
                if saved:
                    saved_digital_files.append(saved)

            product = {
                "id": os.urandom(8).hex(),
                "sku": sku,
                "title": title,
                "description": description,
                "category": category,
                "price": price,
                "images": saved_images,
                "digitalFiles": saved_digital_files,
                "createdAt": now_iso(),
            }

            try:
                insert_product(product)
            except RuntimeError as exc:
                send_json(self, 500, {"success": False, "message": "Failed to save product.", "error": str(exc)})
                return
            send_json(self, 201, {"success": True, "message": "Product saved successfully.", "product": product})
            return

        if path == "/api/orders":
            # Public checkout endpoint - no admin auth required.
            content_length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(content_length).decode("utf-8")
            try:
                payload = json.loads(body or "{}")
            except Exception:
                send_json(self, 400, {"success": False, "message": "Invalid request body."})
                return

            requested_items = payload.get("items") if isinstance(payload.get("items"), list) else []
            try:
                products_by_id = {str(product.get("id")): product for product in read_products()}
            except RuntimeError as exc:
                send_json(self, 500, {"success": False, "message": "Failed to reach the product database.", "error": str(exc)})
                return

            order_items = []
            total = 0.0
            for entry in requested_items:
                if not isinstance(entry, dict):
                    continue
                product = products_by_id.get(str(entry.get("id")))
                if not product:
                    continue
                qty = max(1, int(entry.get("qty") or 1))
                price = float(product.get("price") or 0)
                total += price * qty
                order_items.append({
                    "productId": product.get("id"),
                    "sku": product.get("sku", ""),
                    "title": product.get("title", "Product"),
                    "price": price,
                    "qty": qty,
                    "digitalFiles": [
                        {"id": f.get("id"), "name": f.get("name"), "size": f.get("size", 0)}
                        for f in product.get("digitalFiles", [])
                        if isinstance(f, dict)
                    ],
                })

            if not order_items:
                send_json(self, 400, {"success": False, "message": "No valid items to check out."})
                return

            order = {
                "id": os.urandom(8).hex(),
                "token": os.urandom(24).hex(),
                "items": order_items,
                "total": round(total, 2),
                # STUB: no payment processor is wired in yet, so every order is marked
                # paid immediately. Swap this for a real Stripe/Lemon Squeezy webhook
                # that flips `paid` to True only once the charge actually succeeds.
                "paid": True,
                "createdAt": now_iso(),
            }

            try:
                insert_order(order)
            except RuntimeError as exc:
                send_json(self, 500, {"success": False, "message": "Failed to save order.", "error": str(exc)})
                return
            send_json(self, 201, {"success": True, "order": order})
            return

        self.send_response(404)
        self.end_headers()


if __name__ == "__main__":
    ensure_storage()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), AdminHandler)
    print(f"Dwelling Dream admin app running at http://localhost:{PORT}")
    print(f"Default admin login: username={ADMIN_USERNAME} password={ADMIN_PASSWORD}")
    server.serve_forever()
