"""Windows DPAPI protects local state; Windows Credential Manager protects API keys."""
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import keyring
from keyring.backends.Windows import WinVaultKeyring
SERVICE = 'Marketnote.LSLossGuard'
class Blob(ctypes.Structure):
    _fields_ = [('size', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]

def crypt(raw, decrypt=False):
    if os.name != 'nt':
        raise RuntimeError('Windows required')
    buf = (ctypes.c_ubyte * len(raw)).from_buffer_copy(raw)
    src, dst = Blob(len(raw), buf), Blob()
    fn = ctypes.windll.crypt32.CryptUnprotectData if decrypt else ctypes.windll.crypt32.CryptProtectData
    fn.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p,
                   ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    fn.restype = wintypes.BOOL
    ctypes.windll.kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    ctypes.windll.kernel32.LocalFree.restype = ctypes.c_void_p
    if not fn(ctypes.byref(src), None, None, None, None, 1, ctypes.byref(dst)):
        raise RuntimeError('Secure state unavailable')
    try:
        return ctypes.string_at(dst.data, dst.size)
    finally:
        ctypes.windll.kernel32.LocalFree(dst.data)

def path():
    p = Path(os.environ['LOCALAPPDATA']) / 'MarketnoteLSLossGuard'
    p.mkdir(parents=True, exist_ok=True)
    return p / 'state.dpapi'

def load():
    p = path()
    return json.loads(crypt(p.read_bytes(), True)) if p.exists() else {}

def save(value):
    p = path()
    tmp = p.with_suffix('.tmp')
    tmp.write_bytes(crypt(json.dumps(value, ensure_ascii=False).encode()))
    tmp.replace(p)

def credentials(key=None, secret=None):
    keyring.set_keyring(WinVaultKeyring())  # No plaintext fallback.
    if key is not None:
        keyring.set_password(SERVICE, 'appkey', key)
        keyring.set_password(SERVICE, 'appsecret', secret)
    return keyring.get_password(SERVICE, 'appkey') or '', keyring.get_password(SERVICE, 'appsecret') or ''
