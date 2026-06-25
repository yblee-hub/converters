import os
import json
import random
import string
import urllib.parse
import re
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime

PORT = 3000
DATA_FILE = 'data.json'
RESERVED_PATHS = {'api', 'public', 'index.html', 'style.css', 'app.js', 'favicon.ico'}
ALLOWED_DOMAINS = ['s.careerup.kr', 's.myown.kr', 's.solcompany.kr']

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        if ip != "127.0.0.1":
            return ip
    except Exception:
        pass

    try:
        hostname = socket.gethostname()
        addresses = socket.getaddrinfo(hostname, None)
        for addr in addresses:
            ip = addr[4][0]
            # Match IPv4 local network formats (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
            if re.match(r'^(?:192\.168\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.)', ip):
                return ip
    except Exception:
        pass
        
    return "127.0.0.1"

# ==============================================================================
# CONFIGURATION
# ==============================================================================
# 1. 실제 운영 단계 (도메인 연결):
#    인터넷에 배포하고 실제 도메인(예: https://shortmail.net)을 연결할 경우 아래 주소를 설정하세요.
#    예: BASE_URL = 'https://shortmail.net'
#
# 2. 로컬 테스트 단계 (다른 기기/모바일 스마트폰 테스트):
#    같은 와이파이에 연결된 다른 기기(스마트폰 QR 코드 스캔 등)에서 테스트하려면,
#    컴퓨터의 로컬 IP(예: http://192.168.0.5:3000)를 설정해야 접속이 가능합니다.
#    설정하지 않는 경우(None), 서버가 자동으로 컴퓨터의 현재 로컬 IP를 감지하여 설정합니다.
#
# 3. 1인 로컬 테스트 단계:
#    컴퓨터 1대에서만 테스트하려면 'http://localhost:3000'으로 설정할 수 있습니다.
BASE_URL = None
# ==============================================================================

def load_data():
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump({}, f)
        return {}
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def save_data(data):
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving data: {e}")

def generate_short_code():
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for _ in range(6))

def is_valid_url(url_str):
    try:
        result = urllib.parse.urlparse(url_str)
        return all([result.scheme, result.netloc]) and result.scheme in ('http', 'https')
    except Exception:
        return False

class ShortenerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Serve from the public directory
        public_dir = os.path.join(os.getcwd(), 'public')
        print(f"[debug] Initializing handler with directory: {public_dir}")
        super().__init__(*args, directory=public_dir, **kwargs)

    def do_GET(self):
        print(f"[debug] do_GET path: {self.path}")
        try:
            # Parse path
            parsed_url = urllib.parse.urlparse(self.path)
            path_parts = [p for p in parsed_url.path.split('/') if p]
            print(f"[debug] path_parts: {path_parts}")

            # Case 1: GET /api/history
            if len(path_parts) == 2 and path_parts[0] == 'api' and path_parts[1] == 'history':
                print("[debug] Match GET /api/history")
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                self.end_headers()
                
                database = load_data()
                history = []
                for db_key, info in database.items():
                    domain = 's.careerup.kr'
                    code = db_key
                    if ':' in db_key:
                        domain, code = db_key.split(':', 1)
                    
                    history.append({
                        'domain': domain,
                        'shortCode': code,
                        'shortUrl': f'https://{domain}/{code}',
                        'originalUrl': info['originalUrl'],
                        'clicks': info['clicks'],
                        'createdAt': info['createdAt'],
                        'dbKey': db_key
                    })
                
                # Sort by createdAt desc
                history.sort(key=lambda x: x.get('createdAt', ''), reverse=True)
                self.wfile.write(json.dumps(history).encode('utf-8'))
                return

            # Case 2: GET /api/stats/<code>
            elif len(path_parts) == 3 and path_parts[0] == 'api' and path_parts[1] == 'stats':
                code = path_parts[2]
                print(f"[debug] Match GET /api/stats/{code}")
                database = load_data()
                
                info = None
                domain = 's.careerup.kr'
                db_key = None
                
                # legacy check
                if code in database:
                    info = database[code]
                    db_key = code
                else:
                    for d in ALLOWED_DOMAINS:
                        k = f"{d}:{code}"
                        if k in database:
                            info = database[k]
                            domain = d
                            db_key = k
                            break

                if not info:
                    self.send_response(404)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'Short URL not found.'}).encode('utf-8'))
                    return

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                
                self.wfile.write(json.dumps({
                    'domain': domain,
                    'shortCode': code,
                    'shortUrl': f'https://{domain}/{code}',
                    'originalUrl': info['originalUrl'],
                    'clicks': info['clicks'],
                    'createdAt': info['createdAt'],
                    'dbKey': db_key
                }).encode('utf-8'))
                return

            # Case 3: Redirection GET /<code>
            elif len(path_parts) == 1 and path_parts[0].lower() not in RESERVED_PATHS:
                code = path_parts[0]
                print(f"[debug] Match Redirect GET /{code}")
                database = load_data()
                
                # Determine host
                host_header = self.headers.get('Host', '')
                host = host_header.split(':')[0].lower()
                db_key = f"{host}:{code}"
                
                redirect_url = None
                matched_key = None
                
                if db_key in database:
                    redirect_url = database[db_key]['originalUrl']
                    matched_key = db_key
                elif host in ('localhost', '127.0.0.1') or host.startswith('192.168.') or host.startswith('10.') or host.startswith('172.'):
                    # Fallback for local testing
                    for d in ALLOWED_DOMAINS:
                        k = f"{d}:{code}"
                        if k in database:
                            redirect_url = database[k]['originalUrl']
                            matched_key = k
                            break
                            
                # Legacy fallback
                if not redirect_url and code in database:
                    redirect_url = database[code]['originalUrl']
                    matched_key = code
                
                if redirect_url:
                    # Increment click count
                    database[matched_key]['clicks'] += 1
                    save_data(database)
                    
                    # Redirect
                    self.send_response(302)
                    self.send_header('Location', redirect_url)
                    self.end_headers()
                    return
                else:
                    # Redirect to home with error
                    self.send_response(302)
                    self.send_header('Location', '/?error=notfound')
                    self.end_headers()
                    return

            # Case 4: Default static file serving (handled by SimpleHTTPRequestHandler)
            print("[debug] Delegating GET to super().do_GET()")
            super().do_GET()
        except Exception as e:
            print("[debug] Exception in do_GET:")
            import traceback
            traceback.print_exc()
            try:
                self.send_error(500, message=str(e))
            except Exception:
                pass

    def do_POST(self):
        print(f"[debug] do_POST path: {self.path}")
        try:
            parsed_url = urllib.parse.urlparse(self.path)
            path_parts = [p for p in parsed_url.path.split('/') if p]
            print(f"[debug] path_parts: {path_parts}")

            # Case 1: POST /api/shorten
            if len(path_parts) == 2 and path_parts[0] == 'api' and path_parts[1] == 'shorten':
                print("[debug] Match POST /api/shorten")
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)
                
                try:
                    req_body = json.loads(post_data.decode('utf-8'))
                except Exception:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'Invalid JSON body.'}).encode('utf-8'))
                    return

                url = req_body.get('url')
                custom_code = req_body.get('customCode')
                domain = req_body.get('domain', 's.careerup.kr')

                if not url:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'URL is required.'}).encode('utf-8'))
                    return

                if not is_valid_url(url):
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'Please enter a valid URL (must start with http:// or https://).'}).encode('utf-8'))
                    return

                if domain not in ALLOWED_DOMAINS:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'Invalid domain selected.'}).encode('utf-8'))
                    return

                database = load_data()
                code = custom_code.strip() if custom_code else ''

                if code:
                    # Validate custom code (3-20 characters limit)
                    if not re.match(r'^[a-zA-Z0-9_-]{3,20}$', code):
                        self.send_response(400)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({'error': 'Custom code must be 3-20 alphanumeric characters, hyphens, or underscores.'}).encode('utf-8'))
                        return
                    
                    if code.lower() in RESERVED_PATHS:
                        self.send_response(400)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({'error': 'This custom code is reserved.'}).encode('utf-8'))
                        return

                    db_key = f"{domain}:{code}"
                    if db_key in database:
                        self.send_response(400)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({'error': 'This custom code is already in use for this domain.'}).encode('utf-8'))
                        return
                else:
                    # Generate unique code
                    attempts = 0
                    db_key = None
                    while attempts < 100:
                        code = generate_short_code()
                        db_key = f"{domain}:{code}"
                        if db_key not in database:
                            break
                        attempts += 1
                    
                    if db_key in database:
                        self.send_response(500)
                        self.send_header('Content-Type', 'application/json')
                        self.end_headers()
                        self.wfile.write(json.dumps({'error': 'Failed to generate a unique short code.'}).encode('utf-8'))
                        return

                db_key = f"{domain}:{code}"
                database[db_key] = {
                    'originalUrl': url,
                    'clicks': 0,
                    'createdAt': datetime.utcnow().isoformat() + 'Z'
                }
                save_data(database)

                self.send_response(201)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                
                short_url = f'https://{domain}/{code}'
                self.wfile.write(json.dumps({
                    'domain': domain,
                    'shortCode': code,
                    'shortUrl': short_url,
                    'originalUrl': url,
                    'clicks': 0,
                    'createdAt': database[db_key]['createdAt'],
                    'dbKey': db_key
                }).encode('utf-8'))
                return

            # Case 2: POST /api/shorten-batch
            elif len(path_parts) == 2 and path_parts[0] == 'api' and path_parts[1] == 'shorten-batch':
                print("[debug] Match POST /api/shorten-batch")
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)
                
                try:
                    req_body = json.loads(post_data.decode('utf-8'))
                except Exception:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'Invalid JSON body.'}).encode('utf-8'))
                    return

                items = req_body.get('items', [])
                if not isinstance(items, list):
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'items must be a list.'}).encode('utf-8'))
                    return

                database = load_data()
                results = []
                updated = False

                for item in items:
                    url = item.get('url')
                    domain = item.get('domain', 's.careerup.kr')
                    custom_code = item.get('customCode')

                    if not url:
                        results.append({'success': False, 'error': 'URL is required.', 'originalUrl': url})
                        continue

                    if not is_valid_url(url):
                        results.append({'success': False, 'error': 'Invalid URL format (must start with http:// or https://).', 'originalUrl': url})
                        continue

                    if domain not in ALLOWED_DOMAINS:
                        results.append({'success': False, 'error': 'Invalid domain.', 'originalUrl': url})
                        continue

                    code = custom_code.strip() if custom_code else ''
                    db_key = None

                    if code:
                        if not re.match(r'^[a-zA-Z0-9_-]{3,20}$', code):
                            results.append({'success': False, 'error': 'Code must be 3-20 letters/numbers/hyphens/underscores.', 'originalUrl': url, 'customCode': code})
                            continue
                        if code.lower() in RESERVED_PATHS:
                            results.append({'success': False, 'error': 'Reserved custom code.', 'originalUrl': url, 'customCode': code})
                            continue
                        db_key = f"{domain}:{code}"
                        if db_key in database:
                            results.append({'success': False, 'error': 'Code already in use for this domain.', 'originalUrl': url, 'customCode': code})
                            continue
                    else:
                        attempts = 0
                        while attempts < 100:
                            code = generate_short_code()
                            db_key = f"{domain}:{code}"
                            if db_key not in database:
                                break
                            attempts += 1
                        
                        if db_key in database:
                            results.append({'success': False, 'error': 'Failed to generate unique code.', 'originalUrl': url})
                            continue

                    db_key = f"{domain}:{code}"
                    database[db_key] = {
                        'originalUrl': url,
                        'clicks': 0,
                        'createdAt': datetime.utcnow().isoformat() + 'Z'
                    }
                    updated = True

                    results.append({
                        'success': True,
                        'domain': domain,
                        'shortCode': code,
                        'shortUrl': f'https://{domain}/{code}',
                        'originalUrl': url,
                        'clicks': 0,
                        'createdAt': database[db_key]['createdAt'],
                        'dbKey': db_key
                    })

                if updated:
                    save_data(database)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'results': results}).encode('utf-8'))
                return

            # Case 3: POST /api/delete-batch
            elif len(path_parts) == 2 and path_parts[0] == 'api' and path_parts[1] == 'delete-batch':
                print("[debug] Match POST /api/delete-batch")
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)
                
                try:
                    req_body = json.loads(post_data.decode('utf-8'))
                except Exception:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'Invalid JSON body.'}).encode('utf-8'))
                    return

                keys = req_body.get('keys', [])
                if not isinstance(keys, list):
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'keys must be a list.'}).encode('utf-8'))
                    return

                database = load_data()
                updated = False

                for key in keys:
                    if key in database:
                        del database[key]
                        updated = True

                if updated:
                    save_data(database)

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True}).encode('utf-8'))
                return

            # Otherwise 404
            print(f"[debug] do_POST unmatched path: {self.path}")
            self.send_response(404)
            self.end_headers()
        except Exception as e:
            print("[debug] Exception in do_POST:")
            import traceback
            traceback.print_exc()
            try:
                self.send_error(500, message=str(e))
            except Exception:
                pass

def run(server_class=ThreadingHTTPServer, handler_class=ShortenerHandler, port=PORT):
    # Bind to 0.0.0.0 to listen on all network interfaces
    server_address = ('0.0.0.0', port)
    httpd = server_class(server_address, handler_class)
    local_ip = get_local_ip()
    print(f"Starting multi-threaded server on port {port}...")
    print(f"Local access: http://localhost:{port}")
    print(f"Network access: http://{local_ip}:{port}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()

if __name__ == '__main__':
    run()
