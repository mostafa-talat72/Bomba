#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Unify clocks between two devices over an Ethernet cable (no internet needed).
  Uses Windows' built-in NTP: one device becomes the time server, the other syncs to it.
.EXAMPLE
  # On the MAIN device (the one with the correct clock):
  .\setup-lan-time.ps1 -Mode Server
.EXAMPLE
  # On the SECOND device (replace with the main device's Ethernet IP):
  .\setup-lan-time.ps1 -Mode Client -ServerIP 192.168.10.10
.NOTES
  1. Set the SAME Windows timezone on both devices FIRST (e.g. Cairo).
  2. Open UDP 123 on both (this script adds the firewall rule automatically).
  3. Restart the app on both devices after the clocks agree.
#>
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("Server", "Client")]
    [string]$Mode,
    [string]$ServerIP = ""
)

$ErrorActionPreference = "Stop"

function Add-NtpFirewallRule {
    try {
        netsh advfirewall firewall delete rule name="MTE Systems NTP (UDP 123)" | Out-Null
    } catch {}
    netsh advfirewall firewall add rule name="MTE Systems NTP (UDP 123)" dir=in action=allow protocol=UDP localport=123 profile=private,domain | Out-Null
    Write-Output "Firewall: UDP 123 opened (private/domain)."
}

if ($Mode -eq "Server") {
    Write-Output "Configuring this device as LAN time server..."
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\W32Time\TimeProviders\NtpServer" -Name "Enabled" -Value 1
    Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\W32Time\Config" -Name "AnnounceFlags" -Value 5
    Add-NtpFirewallRule
    Restart-Service w32time
    Start-Sleep -Seconds 2
    Write-Output "Done. This device now serves time to the LAN."
    w32tm /query /status
} else {
    if (-not $ServerIP) { throw "Client mode requires -ServerIP (the main device's Ethernet IP, e.g. 192.168.10.10)." }
    Write-Output "Syncing this device clock to $ServerIP ..."
    Add-NtpFirewallRule
    w32tm /config /manualpeerlist:$ServerIP /syncfromflags:manual /reliable:no /update
    Restart-Service w32time
    Start-Sleep -Seconds 3
    w32tm /resync /force
    Start-Sleep -Seconds 2
    Write-Output "Done. Current status:"
    w32tm /query /status
    Write-Output ""
    Write-Output "Verify: both devices should show the same second. Then restart the app on both."
}
