# Generate a self-signed code signing certificate for testing
# Usage: powershell -ExecutionPolicy Bypass -File scripts/generate-cert.ps1
# Output: build/cert.pfx

$ErrorActionPreference = "Stop"

$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=AI GUI" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -HashAlgorithm SHA256 `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -NotAfter (Get-Date).AddYears(3)

$password = Read-Host -Prompt "Enter password for PFX (or press Enter for 'ai-gui-test')" -AsSecureString
if ($password.Length -eq 0) {
    $password = ConvertTo-SecureString -String "ai-gui-test" -Force -AsPlainText
}

Export-PfxCertificate -Cert $cert -FilePath "build/cert.pfx" -Password $password

Write-Host ""
Write-Host "Certificate generated successfully:" -ForegroundColor Green
Write-Host "  Thumbprint: $($cert.Thumbprint)"
Write-Host "  Subject:    $($cert.Subject)"
Write-Host "  Expires:    $($cert.NotAfter.ToString('yyyy-MM-dd'))"
Write-Host "  PFX:        build/cert.pfx"
Write-Host ""
Write-Host "To build a signed installer:" -ForegroundColor Yellow
Write-Host '  $env:CSC_KEY_PASSWORD="your-password"; npm run build:win'
