from __future__ import annotations

from playwright.sync_api import Page, expect


def test_navigation_and_sidebar(page: Page, base_url: str) -> None:
    page.goto(base_url)
    expect(page.get_by_test_id("link-vms")).to_be_visible()

    page.get_by_test_id("link-vms").click()
    expect(page.get_by_test_id("page-vms")).to_be_visible()

    page.get_by_test_id("link-clusters").click()
    expect(page.get_by_test_id("page-clusters")).to_be_visible()

    page.get_by_test_id("link-fleet").click()
    expect(page.get_by_test_id("page-fleet")).to_be_visible()

    page.get_by_test_id("link-ipam").click()
    expect(page.get_by_test_id("page-ipam")).to_be_visible()

    page.get_by_test_id("link-settings").click()
    expect(page.get_by_test_id("page-settings")).to_be_visible()


def test_site_mode_toggle(page: Page, base_url: str) -> None:
    page.goto(base_url)
    badge = page.get_by_test_id("header-mode-badge")
    expect(badge).to_have_text("Forge Central Console")

    page.get_by_test_id("toggle-mode").click()
    expect(badge).to_have_text("Forge Fleet Dashboard")

    page.get_by_test_id("toggle-mode").click()
    expect(badge).to_have_text("Forge Central Console")


def test_theme_mode_switch(page: Page, base_url: str) -> None:
    page.goto(base_url)
    toggle = page.get_by_test_id("toggle-theme-mode")
    root = page.locator("html")

    expect(toggle).to_contain_text("Dark")
    expect(root).to_have_class("dark")
    assert page.evaluate("() => window.localStorage.getItem('forge_theme_preference')") == "dark"

    toggle.click()
    expect(toggle).to_contain_text("Light")
    expect(root).not_to_have_class("dark")
    assert page.evaluate("() => window.localStorage.getItem('forge_theme_preference')") == "light"

    toggle.click()
    expect(toggle).to_contain_text("System")
    assert page.evaluate("() => window.localStorage.getItem('forge_theme_preference')") == "system"

    is_dark_expected = page.evaluate(
        "() => window.matchMedia('(prefers-color-scheme: dark)').matches"
    )
    if is_dark_expected:
        expect(root).to_have_class("dark")
    else:
        expect(root).not_to_have_class("dark")


def test_live_terminal_streaming(page: Page, base_url: str, e2e_lab: str) -> None:
    page.goto(f"{base_url}/clusters/deploy")
    # Stage 1 inherits the seeded lab; advance to Stage 4 (config generated) and Launch for Stage 5
    expect(page.get_by_test_id("select-lab")).to_have_value(e2e_lab)
    page.get_by_test_id("btn-wizard-next").click()
    page.get_by_test_id("btn-wizard-next").click()
    page.get_by_test_id("btn-wizard-next").click()
    page.get_by_test_id("btn-wizard-launch").click()
    expect(page.get_by_test_id("terminal-live-logs")).to_be_visible()
    expect(page.get_by_test_id("terminal-line-1")).to_contain_text("mock stdout line 1", timeout=10000)
    expect(page.get_by_test_id("terminal-line-2")).to_contain_text("mock stdout line 2", timeout=10000)



