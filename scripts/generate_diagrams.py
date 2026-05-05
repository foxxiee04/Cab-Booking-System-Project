"""
Render professional Mermaid diagrams to PNG for docs / slides.

Source of truth: docs/diagrams/mermaid/*.mmd (clean layered diagrams, interview style).
Requires Node: npx @mermaid-js/mermaid-cli

  python scripts/generate_diagrams.py

Output: img/01_system_architecture_overview.png … img/20_*.png
"""

from __future__ import annotations

import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MERMAID_DIR = os.path.join(ROOT, "docs", "diagrams", "mermaid")
OUT = os.path.join(ROOT, "img")

# mmd stem → png filename (stable names for thesis / repo)
RENDER_MAP = [
    ("01_system_architecture_overview", "01_system_architecture_overview.png"),
    ("02_aws_deployment_architecture", "02_aws_deployment_architecture.png"),
    ("03_realtime_communication_flow", "03_realtime_communication_flow.png"),
    ("04_booking_payment_flow", "04_booking_payment_flow.png"),
    ("05_data_architecture", "05_data_architecture.png"),
    ("06_ai_ml_pipeline", "06_ai_ml_pipeline.png"),
    ("07_use_case_overview", "07_use_case_overview.png"),
    ("08_state_machine_ride", "08_state_machine_ride.png"),
    ("09_state_machine_wallet", "09_state_machine_wallet.png"),
    ("10_activity_booking_flow", "10_activity_booking_flow.png"),
    ("11_activity_payment_branch", "11_activity_payment_branch.png"),
    ("12_bpmn_booking_lanes", "12_bpmn_booking_lanes.png"),
    ("13_event_flow_rabbitmq", "13_event_flow_rabbitmq.png"),
    ("14_api_gateway_routing_map", "14_api_gateway_routing_map.png"),
    ("15_driver_matching_flow", "15_driver_matching_flow.png"),
    ("16_rag_chatbot_architecture", "16_rag_chatbot_architecture.png"),
    ("17_sequence_auth_otp", "17_sequence_auth_otp.png"),
    ("18_erd_core_services", "18_erd_core_services.png"),
    ("19_component_api_gateway", "19_component_api_gateway.png"),
    ("20_security_trust_boundary", "20_security_trust_boundary.png"),
]

MERMAID_CLI = "@mermaid-js/mermaid-cli@11.4.2"

# Một số sơ đồ cần canvas rộng hơn để nhãn mũi tên không chồng chéo
# (chiều rộng px, chiều cao px, scale tùy chọn cho puppeteer)
SIZE_OVERRIDES: dict[str, tuple[str, str, str | None]] = {
    "01_system_architecture_overview": ("3200", "2800", "1.05"),
}


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    for stem, png_name in RENDER_MAP:
        src = os.path.join(MERMAID_DIR, f"{stem}.mmd")
        dst = os.path.join(OUT, png_name)
        if not os.path.isfile(src):
            print(f"Missing source: {src}", file=sys.stderr)
            return 1
        w, h, scale = SIZE_OVERRIDES.get(stem, ("2200", "1500", None))
        cmd = [
            "npx",
            "-y",
            MERMAID_CLI,
            "-i",
            src,
            "-o",
            dst,
            "-b",
            "white",
            "-w",
            w,
            "-H",
            h,
        ]
        if scale:
            cmd.extend(["-s", scale])
        print(f"→ {png_name}")
        subprocess.run(cmd, check=True, cwd=ROOT, shell=(os.name == "nt"))
    print(f"Done. Output: {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
