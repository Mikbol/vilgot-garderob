#!/usr/bin/env python3
"""JSON-in-HTML helper for Vilgots Garderob lookbook.

Handles extraction, injection and manipulation of the PRODUCTS JSON array
embedded in index.html. Uses json.JSONDecoder.raw_decode() for robust parsing.

Usage (called by add-item.sh, not directly):
    python3 json-helper.py extract index.html
    python3 json-helper.py inject index.html product.json
    python3 json-helper.py list index.html
    python3 json-helper.py count index.html
    python3 json-helper.py exists index.html --url "https://..."
    python3 json-helper.py exists index.html --name "Product Name"
    python3 json-helper.py remove index.html --id 42
    python3 json-helper.py next-id index.html
"""

import sys
import os
import re
import json
import argparse


def extract_products(html):
    """Extract PRODUCTS array from HTML using raw_decode (handles all edge cases)."""
    start_match = re.search(r'const PRODUCTS\s*=\s*', html)
    if not start_match:
        raise ValueError("Could not find 'const PRODUCTS =' in HTML")
    json_start = start_match.end()
    decoder = json.JSONDecoder()
    products, json_end = decoder.raw_decode(html, json_start)
    if not isinstance(products, list):
        raise ValueError(f"PRODUCTS is not an array, got {type(products).__name__}")
    return products, json_start, json_end


def inject_products(html, products, json_start, json_end):
    """Replace PRODUCTS array in HTML with updated version."""
    json_str = json.dumps(products, indent=2, ensure_ascii=False)
    return html[:json_start] + json_str + html[json_end:]


def write_html_atomic(path, content):
    """Atomic write: write to temp file, then rename."""
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(content)
    os.replace(tmp, path)


def check_duplicate(products, url=None, name=None):
    """Check if a product already exists. Returns matching product or None."""
    for p in products:
        if url and p.get('url') == url:
            return p
        if name and p.get('name') == name:
            return p
    return None


def get_next_id(products):
    """Get the next available product ID."""
    if not products:
        return 1
    return max(p.get('id', 0) for p in products) + 1


def cmd_extract(args):
    with open(args.html, 'r', encoding='utf-8') as f:
        html = f.read()
    products, _, _ = extract_products(html)
    json.dump(products, sys.stdout, indent=2, ensure_ascii=False)
    print()


def cmd_inject(args):
    with open(args.html, 'r', encoding='utf-8') as f:
        html = f.read()
    products, json_start, json_end = extract_products(html)

    with open(args.product_json, 'r', encoding='utf-8') as f:
        new_product = json.load(f)

    # Check duplicate
    dup = check_duplicate(products, url=new_product.get('url'), name=new_product.get('name'))
    if dup:
        print(json.dumps({"error": "duplicate", "existing": dup}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)

    # Assign ID if not present
    if 'id' not in new_product:
        new_product['id'] = get_next_id(products)

    products.append(new_product)
    new_html = inject_products(html, products, json_start, json_end)
    write_html_atomic(args.html, new_html)

    result = {"status": "added", "id": new_product['id'], "name": new_product.get('name', ''), "total": len(products)}
    print(json.dumps(result, ensure_ascii=False))


def cmd_list(args):
    with open(args.html, 'r', encoding='utf-8') as f:
        html = f.read()
    products, _, _ = extract_products(html)

    if args.json:
        json.dump(products, sys.stdout, indent=2, ensure_ascii=False)
        print()
    else:
        print(f"Totalt: {len(products)} produkter\n")
        for p in products:
            tag = f" [{p['tag']}]" if p.get('tag') else ""
            price = p.get('price', '?')
            brand = p.get('brand', '')
            print(f"{p.get('id', '?'):>3}. {p['name']:<45s} {price:>15s}  {brand}{tag}")


def cmd_count(args):
    with open(args.html, 'r', encoding='utf-8') as f:
        html = f.read()
    products, _, _ = extract_products(html)
    print(len(products))


def cmd_exists(args):
    with open(args.html, 'r', encoding='utf-8') as f:
        html = f.read()
    products, _, _ = extract_products(html)

    dup = check_duplicate(products, url=args.url, name=args.name)
    if dup:
        print(json.dumps({"exists": True, "product": dup}, ensure_ascii=False))
        sys.exit(0)
    else:
        print(json.dumps({"exists": False}, ensure_ascii=False))
        sys.exit(1)


def cmd_remove(args):
    with open(args.html, 'r', encoding='utf-8') as f:
        html = f.read()
    products, json_start, json_end = extract_products(html)

    target_id = int(args.id)
    original_len = len(products)
    products = [p for p in products if p.get('id') != target_id]

    if len(products) == original_len:
        print(json.dumps({"error": "not_found", "id": target_id}, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)

    new_html = inject_products(html, products, json_start, json_end)
    write_html_atomic(args.html, new_html)
    print(json.dumps({"status": "removed", "id": target_id, "total": len(products)}, ensure_ascii=False))


def cmd_next_id(args):
    with open(args.html, 'r', encoding='utf-8') as f:
        html = f.read()
    products, _, _ = extract_products(html)
    print(get_next_id(products))


def main():
    parser = argparse.ArgumentParser(description='JSON-in-HTML helper for Vilgots Garderob')
    sub = parser.add_subparsers(dest='command', required=True)

    p_extract = sub.add_parser('extract')
    p_extract.add_argument('html')

    p_inject = sub.add_parser('inject')
    p_inject.add_argument('html')
    p_inject.add_argument('product_json')

    p_list = sub.add_parser('list')
    p_list.add_argument('html')
    p_list.add_argument('--json', action='store_true')

    p_count = sub.add_parser('count')
    p_count.add_argument('html')

    p_exists = sub.add_parser('exists')
    p_exists.add_argument('html')
    p_exists.add_argument('--url', default=None)
    p_exists.add_argument('--name', default=None)

    p_remove = sub.add_parser('remove')
    p_remove.add_argument('html')
    p_remove.add_argument('--id', required=True)

    p_next = sub.add_parser('next-id')
    p_next.add_argument('html')

    args = parser.parse_args()

    commands = {
        'extract': cmd_extract,
        'inject': cmd_inject,
        'list': cmd_list,
        'count': cmd_count,
        'exists': cmd_exists,
        'remove': cmd_remove,
        'next-id': cmd_next_id,
    }

    commands[args.command](args)


if __name__ == '__main__':
    main()
