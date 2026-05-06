import json, urllib.request, os, sys

login_file = os.path.join(os.environ['TEMP'], 'clogin.json')
d = json.load(open(login_file))
tok = d['data']['tokens']['accessToken']

body = json.dumps({
    'pickup': {'lat': 10.8192, 'lng': 106.6685, 'address': '12 Nguyen Van Bao, IUH, Go Vap'},
    'dropoff': {'lat': 10.8268, 'lng': 106.6667, 'address': 'Vincom Plaza Go Vap'},
    'vehicleType': 'CAR_4',
    'paymentMethod': 'CASH'
}).encode()

req = urllib.request.Request(
    'http://localhost:3000/api/rides',
    data=body,
    headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok},
    method='POST'
)
try:
    with urllib.request.urlopen(req, timeout=15) as r:
        resp = json.loads(r.read())
        ride = resp['data']['ride']
        print(f"Ride ID: {ride['id']}")
        print(f"Status:  {ride['status']}")
        print(f"Fare:    {ride['fare']:,} VND")
        print(f"Vehicle: {ride['vehicleType']}")
        print(f"Payment: {ride['paymentMethod']}")
except urllib.error.HTTPError as e:
    print('HTTP Error', e.code, e.read().decode()[:500])
except Exception as e:
    print('Error:', e)
