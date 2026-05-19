@echo off
REM Intel Proxy Configuration for Windows

REM Set lowercase proxy variables
set NO_PROXY=localhost,127.0.0.1,*.intel.com,.openai.azure.com,10.*
set no_proxy=%NO_PROXY%
set http_proxy=http://proxy-dmz.intel.com:912
set https_proxy=http://proxy-dmz.intel.com:912
set ftp_proxy=http://proxy-dmz.intel.com:911

REM Set uppercase proxy variables
set HTTP_PROXY=http://proxy-dmz.intel.com:912/
set HTTPS_PROXY=http://proxy-dmz.intel.com:912/
set FTP_PROXY=ftp://proxy-dmz.intel.com:911/

REM Display confirmation
echo Proxy settings configured:
echo NO_PROXY=%NO_PROXY%
echo HTTP_PROXY=%HTTP_PROXY%
echo HTTPS_PROXY=%HTTPS_PROXY%
echo FTP_PROXY=%FTP_PROXY%

REM Keep window open to see results