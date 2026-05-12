#!/usr/bin/env bash
# Load KEY=value pairs from a dotenv file without evaluating it as shell code.

load_dotenv() {
  local env_file="${1:-.env}"
  local line key value line_no

  [[ -f "$env_file" ]] || return 0

  line_no=0
  while IFS= read -r line || [[ -n "$line" ]]; do
    line_no=$((line_no + 1))
    line="${line%$'\r'}"
    [[ $line_no -eq 1 ]] && line="${line#$'\xef\xbb\xbf'}"

    # Trim leading whitespace before checking comments/export.
    line="${line#"${line%%[![:space:]]*}"}"

    [[ -z "$line" || "$line" == \#* ]] && continue

    if [[ "$line" == export[[:space:]]* ]]; then
      line="${line#export}"
      line="${line#"${line%%[![:space:]]*}"}"
    fi

    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      value="${BASH_REMATCH[2]}"

      value="${value#"${value%%[![:space:]]*}"}"
      value="${value%"${value##*[![:space:]]}"}"

      if [[ ${#value} -ge 2 ]]; then
        case "$value" in
          \"*\") value="${value:1:${#value}-2}" ;;
          \'*\') value="${value:1:${#value}-2}" ;;
        esac
      fi

      export "$key=$value"
    else
      printf 'Skipping invalid dotenv line %s in %s\n' "$line_no" "$env_file" >&2
    fi
  done < "$env_file"
}
