# -*- coding: utf-8 -*-
"""生成一个新激活码。
用法:
    python scripts/gen_code.py 张三
会:
  1) 自动读取 access.js 里的 salt
  2) 生成一个随机激活码
  3) 打印「明文激活码」(私下发给那个人) 和要粘进 access.js codes 数组的一行

把那一行加到 access.js 的 codes:[] 里, 重新部署即可生效。
"""
import sys, os, re, secrets, hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ACCESS = os.path.join(ROOT, "access.js")
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # 去掉易混字符 0/O/1/I


def read_salt():
    txt = open(ACCESS, encoding="utf-8").read()
    m = re.search(r'salt:\s*"([0-9a-fA-F]+)"', txt)
    if not m:
        raise SystemExit("在 access.js 里找不到 salt")
    return m.group(1)


def gen_code():
    s = "".join(secrets.choice(ALPHABET) for _ in range(8))
    return s[:4] + "-" + s[4:]


def main():
    label = sys.argv[1] if len(sys.argv) > 1 else "新用户"
    salt = read_salt()
    code = gen_code()
    h = hashlib.sha256((salt + ":" + code).encode()).hexdigest()
    print("=" * 50)
    print("明文激活码 (私发给本人):", code)
    print("=" * 50)
    print("把下面这一行加进 access.js 的 codes 数组:")
    print('    { label: "%s", hash: "%s" },' % (label, h))


if __name__ == "__main__":
    main()
