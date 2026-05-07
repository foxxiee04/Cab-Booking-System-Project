"""
Render professional Mermaid diagrams to PNG for docs / slides.

Source of truth: docs/diagrams/mermaid/*.mmd (clean layered diagrams, interview style).
Requires Node: npx @mermaid-js/mermaid-cli

  python scripts/generate_diagrams.py

Output: img/{loại}_{chức_năng}_….png (khớp `docs/bao-cao-kltn.md` và `scripts/apply-img-taxonomy.mjs`).
Sơ đồ AI (train/infer, RAG): dùng `docs/diagrams/mermaid/source/ai_*.mmd` — xuất thủ công hoặc quy trình riêng.
"""

from __future__ import annotations

import os
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MERMAID_DIR = os.path.join(ROOT, "docs", "diagrams", "mermaid")
OUT = os.path.join(ROOT, "img")

# File .mmd (stem) → PNG theo taxonomy (báo cáo tham chiếu tên này)
RENDER_MAP = [
    ("01_system_architecture_overview", "arch_system_overview.png"),
    ("02_aws_deployment_architecture", "deploy_aws_reference_ecs.png"),
    ("03_realtime_communication_flow", "arch_realtime_socket_webrtc.png"),
    ("04_booking_payment_flow", "seq_booking_payment_overview.png"),
    ("05_data_architecture", "data_db_per_service_overview.png"),
    ("07_use_case_overview", "uc_journey_roles_en.png"),
    ("08_state_machine_ride", "stm_ride_lifecycle_simple.png"),
    ("09_state_machine_wallet", "stm_wallet_fintech.png"),
    ("10_activity_booking_flow", "act_booking_end_to_end.png"),
    ("11_activity_payment_branch", "act_payment_by_method.png"),
    ("12_bpmn_booking_lanes", "bpmn_booking_swimlanes.png"),
    ("13_event_flow_rabbitmq", "evt_rabbitmq_domain_flow.png"),
    ("14_api_gateway_routing_map", "gw_routing_map.png"),
    ("15_driver_matching_flow", "flow_driver_matching_radius.png"),
    ("17_sequence_auth_otp", "seq_auth_otp_register_reset.png"),
    ("18_erd_core_services", "erd_core_bounded_contexts.png"),
    ("19_component_api_gateway", "gw_component_internal_stack.png"),
    ("20_security_trust_boundary", "sec_trust_boundary_multitier.png"),
    ("21_aws_swarm_deployment_actual", "deploy_swarm_aws_asbuilt.png"),
    ("22_aws_target_reference_topology", "deploy_aws_topology_target.png"),
    ("23_cicd_pipeline_github_actions", "cicd_github_actions_docker.png"),
]

MERMAID_CLI = "@mermaid-js/mermaid-cli@11.4.2"

# Một số sơ đồ cần canvas rộng hơn để nhãn mũi tên không chồng chéo
# (chiều rộng px, chiều cao px, scale tùy chọn cho puppeteer)
SIZE_OVERRIDES: dict[str, tuple[str, str, str | None]] = {
    "01_system_architecture_overview": ("3200", "2800", "1.05"),
    "14_api_gateway_routing_map": ("2600", "3200", "1.0"),
    "05_data_architecture": ("3400", "1500", "1.0"),
    "21_aws_swarm_deployment_actual": ("4200", "1100", None),
    "22_aws_target_reference_topology": ("2400", "2200", None),
    "23_cicd_pipeline_github_actions": ("3000", "1100", None),
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
