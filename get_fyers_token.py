import sys
import json
import hashlib
import urllib.request
import urllib.error

def generate_fyers_token(app_id, secret_id, auth_code):
    raw_hash = f"{app_id}:{secret_id}"
    app_id_hash = hashlib.sha256(raw_hash.encode('utf-8')).hexdigest()

    payload = json.dumps({
        "grant_type": "authorization_code",
        "appIdHash": app_id_hash,
        "code": auth_code
    }).encode('utf-8')

    headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    req = urllib.request.Request(
        'https://api-t1.fyers.in/api/v3/validate-authcode',
        data=payload,
        headers=headers,
        method='POST'
    )

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        try:
            return json.loads(err_body)
        except:
            return {"s": "error", "message": err_body}
    except Exception as e:
        return {"s": "error", "message": str(e)}

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python get_fyers_token.py <APP_ID> <SECRET_ID> <AUTH_CODE>")
        sys.exit(1)
    
    app_id = sys.argv[1]
    secret_id = sys.argv[2]
    auth_code = sys.argv[3]

    res = generate_fyers_token(app_id, secret_id, auth_code)
    print("\n--- FYERS TOKEN RESPONSE ---")
    print(json.dumps(res, indent=2))
