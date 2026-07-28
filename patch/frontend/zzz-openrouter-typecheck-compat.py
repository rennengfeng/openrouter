#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path


PROJECT_ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
FRONTEND = sys.argv[2] if len(sys.argv) > 2 else "openrouter"


def frontend_root() -> Path:
    candidate = PROJECT_ROOT / "web" / FRONTEND
    if candidate.exists():
        return candidate
    if (PROJECT_ROOT / "src").exists():
        return PROJECT_ROOT
    raise SystemExit(f"openrouter typecheck compatibility patch failed: missing frontend root {candidate}")


def read(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def write(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def patch_code_block(root: Path) -> None:
    path = root / "src" / "components" / "ai-elements" / "code-block.tsx"
    text = read(path)
    if not text:
        return
    text = text.replace("import type { Element } from 'hast'\n", "")
    text = text.replace("  line(node: Element, line: number) {", "  line(node, line: number) {")
    write(path, text)


def patch_channel_test_dialog(root: Path) -> None:
    path = root / "src" / "features" / "channels" / "components" / "dialogs" / "channel-test-dialog.tsx"
    text = read(path)
    if not text:
        return
    text = text.replace("\nconst ALI_CHANNEL_TYPE = 17\n", "\n")
    write(path, text)


def patch_model_square(root: Path) -> None:
    path = root / "src" / "features" / "frontend-portal" / "model-square.tsx"
    text = read(path)
    if not text:
        return
    text = text.replace(
        "<Select value={vendorFilter} onValueChange={setVendorFilter}>",
        "<Select\n          value={vendorFilter}\n          onValueChange={(value) => setVendorFilter(value ?? 'all')}\n        >",
    )
    write(path, text)


def patch_model_pricing_sheet(root: Path) -> None:
    path = root / "src" / "features" / "system-settings" / "models" / "model-pricing-sheet.tsx"
    text = read(path)
    if not text:
        return
    text = re.sub(
        r"import \{\n  Select,\n  SelectContent,\n  SelectGroup,\n  SelectItem,\n  SelectTrigger,\n  SelectValue,\n\} from '@/components/ui/select'\n",
        "",
        text,
    )
    write(path, text)


def patch_tiered_pricing_editor(root: Path) -> None:
    path = root / "src" / "features" / "system-settings" / "models" / "tiered-pricing-editor.tsx"
    text = read(path)
    if not text:
        return
    text = text.replace(
        "  const handleVarChange = (value: string) => {\n    const nextVar = value as TierConditionInput['var']",
        "  const handleVarChange = (value: string | null) => {\n    if (value === null) return\n    const nextVar = value as TierConditionInput['var']",
    )
    text = text.replace(
        "        onValueChange={(value) =>\n          onChange({ ...condition, op: value as TierConditionInput['op'] })\n        }",
        "        onValueChange={(value) => {\n          if (value === null) return\n          onChange({ ...condition, op: value as TierConditionInput['op'] })\n        }}",
    )
    text = text.replace(
        "          onValueChange={(value) => onChange({ ...condition, value })}",
        "          onValueChange={(value) => {\n            if (value === null) return\n            onChange({ ...condition, value })\n          }}",
    )
    write(path, text)


def patch_oauth_providers(root: Path) -> None:
    path = root / "src" / "features" / "auth" / "components" / "oauth-providers.tsx"
    text = read(path)
    if not text:
        return
    text = text.replace(
        "            botId={status!.telegram_bot_id!}\n",
        "            botId={String(status!.telegram_bot_id!)}\n",
    )
    text = text.replace(
        "            lang={i18n.language}\n",
        "            lang={String(i18n.language)}\n",
    )
    write(path, text)


def patch_use_oauth_login(root: Path) -> None:
    path = root / "src" / "features" / "auth" / "hooks" / "use-oauth-login.ts"
    text = read(path)
    if not text:
        return
    if "pickTelegramAuthorization" not in text:
        text = text.replace(
            "import type { TelegramAuthData } from '../components/telegram-login-button'\n",
            "import { pickTelegramAuthorization } from '../lib/telegram-login'\n"
            "import type { TelegramAuthData } from '../components/telegram-login-button'\n",
        )
    text = re.sub(
        r"\s+// Forward the Telegram-signed fields to the backend for HMAC validation\.\n"
        r"\s+const fields = \[\n"
        r"\s+'id',\n"
        r"\s+'first_name',\n"
        r"\s+'last_name',\n"
        r"\s+'username',\n"
        r"\s+'photo_url',\n"
        r"\s+'auth_date',\n"
        r"\s+'hash',\n"
        r"\s+'lang',\n"
        r"\s+\]\n"
        r"\s+const params: Record<string, string> = \{\}\n"
        r"\s+for \(const field of fields\) \{\n"
        r"\s+const value = \(authData as Record<string, unknown>\)\[field\]\n"
        r"\s+if \(value !== undefined && value !== null\) \{\n"
        r"\s+params\[field\] = String\(value\)\n"
        r"\s+\}\n"
        r"\s+\}\n\n"
        r"\s+const res = await telegramLogin\(params\)",
        "\n      // Forward the Telegram-signed fields to the backend for HMAC validation.\n"
        "      const params = pickTelegramAuthorization(authData)\n"
        "      if (!params) {\n"
        "        toast.error(t('Telegram login failed'))\n"
        "        return\n"
        "      }\n\n"
        "      const res = await telegramLogin(params)",
        text,
        count=1,
    )
    write(path, text)


def patch_portal_route(root: Path) -> None:
    path = root / "src" / "routes" / "portal" / "route.tsx"
    text = read(path)
    if not text:
        return
    text = text.replace(
        "function PortalRoute() {\n  const user = useAuthStore((s) => s.auth.user)\n",
        "function PortalRoute() {\n  const user = useAuthStore((s) => s.auth.user)\n  const accessToken = useAuthStore((s) => s.auth.accessToken)\n",
    )
    write(path, text)


def main() -> None:
    root = frontend_root()
    patch_code_block(root)
    patch_channel_test_dialog(root)
    patch_model_square(root)
    patch_model_pricing_sheet(root)
    patch_tiered_pricing_editor(root)
    patch_oauth_providers(root)
    patch_use_oauth_login(root)
    patch_portal_route(root)
    print("applied openrouter typecheck compatibility frontend patch")


if __name__ == "__main__":
    main()
