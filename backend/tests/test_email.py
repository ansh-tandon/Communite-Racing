from app.services.email import login_email


def test_login_email_has_code_and_expiry():
    body, text = login_email("042917", 10, "")
    assert "042917" in body and "10 minutes" in body
    assert "042917" in text and "10 minutes" in text
    assert "$" not in body  # every placeholder filled
    assert "COMMUNITIE RACING" in body and "<img" not in body


def test_login_email_logo():
    body, _ = login_email("042917", 10, 'https://example.com/logo.png?a=1&b="x"')
    assert '<img src="https://example.com/logo.png?a=1&amp;b=&quot;x&quot;"' in body
