"""Test-only broken subprocess; never imported by the application."""
import json
import os
import sys
for line in sys.stdin:
    request = json.loads(line)
    mode = request['text']
    if mode == 'crash':
        os._exit(1)
    if mode == 'malformed':
        print('not-json', flush=True)
    elif mode == 'null-response':
        print('null', flush=True)
    elif mode == 'array-response':
        print('[]', flush=True)
    elif mode == 'invalid-result':
        print(json.dumps({'id': request['id'], 'type': 'result', 'result': {'aiProbability': 'invalid'}}), flush=True)
    elif mode == 'hang':
        print(json.dumps({'id': request['id'], 'type': 'status', 'phase': 'loading', 'message': 'Test waiting'}), flush=True)
    else:
        print(json.dumps({'id': request['id'], 'type': 'error', 'message': 'Detection unavailable: test inference failure.'}), flush=True)
