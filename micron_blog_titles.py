"""Fetch and print blog post titles from Micron's blog."""
from __future__ import annotations

import json
from typing import Iterable, List, Set

import requests
from bs4 import BeautifulSoup

BLOG_URL = "https://www.micron.com/about/blog"

# Use a desktop user agent to avoid being blocked by basic bot filters.
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    )
}


def _unique_texts(elements: Iterable[str]) -> List[str]:
    """Return a list of unique, non-empty strings preserving order."""
    seen: Set[str] = set()
    results: List[str] = []
    for text in elements:
        cleaned = text.strip()
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            results.append(cleaned)
    return results


def _titles_from_json(data: object) -> List[str]:
    """Recursively gather probable title strings from JSON data."""
    titles: List[str] = []

    def walk(node: object) -> None:
        if isinstance(node, dict):
            for key, value in node.items():
                if isinstance(value, (dict, list)):
                    walk(value)
                elif (
                    isinstance(value, str)
                    and key.lower() in {"title", "headline", "name"}
                    and len(value.split()) > 2
                ):
                    titles.append(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(data)
    return _unique_texts(titles)


def fetch_blog_titles(url: str = BLOG_URL) -> List[str]:
    """Fetch Micron blog page and return a list of post titles."""
    response = requests.get(url, headers=HEADERS, timeout=15)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    selectors = [
        "a.blog-card__link-title",
        "a.blog-card__title",
        "a.c-articleListing__title",
        "h2.blog-card__title",
        "h3.blog-card__title",
    ]

    extracted: List[str] = []
    for selector in selectors:
        for element in soup.select(selector):
            extracted.append(element.get_text(strip=True))

    titles = _unique_texts(extracted)
    if titles:
        return titles

    # Fallback: attempt to parse titles from embedded JSON (e.g., Next.js data).
    next_data = soup.find("script", id="__NEXT_DATA__")
    if next_data and next_data.string:
        try:
            data = json.loads(next_data.string)
        except json.JSONDecodeError:
            pass
        else:
            titles = _titles_from_json(data)
            if titles:
                return titles

    # Final fallback: collect text from generic heading elements.
    headings = [tag.get_text(strip=True) for tag in soup.find_all(["h2", "h3"]) if tag.get_text(strip=True)]
    return _unique_texts(headings)


def main() -> None:
    titles = fetch_blog_titles()
    for title in titles:
        print(title)


if __name__ == "__main__":
    main()
