#!/usr/bin/env bash
set -euo pipefail

# POSIX proxy settings approximating proxy.bat
NO_PROXY="localhost,127.0.0.1,*.intel.com,.openai.azure.com,10.*"
export NO_PROXY
export no_proxy="$NO_PROXY"
export http_proxy="http://proxy-dmz.intel.com:912"
export https_proxy="http://proxy-dmz.intel.com:912"
export ftp_proxy="http://proxy-dmz.intel.com:911"
export HTTP_PROXY="$http_proxy"
export HTTPS_PROXY="$https_proxy"
export FTP_PROXY="ftp://proxy-dmz.intel.com:911/"

echo "Proxy settings configured:"
echo "NO_PROXY=$NO_PROXY"
echo "HTTP_PROXY=$HTTP_PROXY"
echo "HTTPS_PROXY=$HTTPS_PROXY"
echo "FTP_PROXY=$FTP_PROXY"

# If Wine is available and the original Windows batch exists, run it for Windows tools
if command -v wine >/dev/null 2>&1 && [ -f "proxy.bat" ]; then
  echo "Running proxy.bat under Wine for Windows tools..."
  wine cmd /c proxy.bat || true
fi

# Keep script sourced-friendly: exit only if executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  true
fi
