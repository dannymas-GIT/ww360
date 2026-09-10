// VM for AquaSafe (Docker host). Requires network module outputs.
@description('Environment: dev, staging, prod')
param environment string = 'dev'

@description('Resource name prefix')
param namePrefix string = 'aquasafe'

@description('VM size')
@allowed([
  'Standard_B2s'
  'Standard_B1ms'
  'Standard_B2ms'
  'Standard_B4ms'
  'Standard_B2pls_v2'
  'Standard_B2ps_v2'
  'Standard_D2s_v3'
  'Standard_D4s_v3'
  'Standard_D2s_v5'
  'Standard_D2s_v7'
])
param vmSize string = 'Standard_D2s_v5'

@description('Admin username')
param adminUsername string = 'azureuser'

@description('SSH public key')
param sshPublicKey string

@description('Subnet ID from network module')
param subnetId string

@description('Location')
param location string = resourceGroup().location

var vmName = '${namePrefix}-${environment}-vm'
var nicName = '${vmName}-nic'
var pipName = '${vmName}-pip'
var dnsLabel = toLower('${namePrefix}-${environment}-${uniqueString(resourceGroup().id)}')

// Standard SKU: many subscriptions allow 0 Basic public IPs (IPv4BasicSkuPublicIpCountLimitReached).
resource publicIp 'Microsoft.Network/publicIPAddresses@2023-04-01' = {
  name: pipName
  location: location
  sku: {
    name: 'Standard'
    tier: 'Regional'
  }
  properties: {
    publicIPAllocationMethod: 'Static'
    dnsSettings: { domainNameLabel: dnsLabel }
  }
}

resource nic 'Microsoft.Network/networkInterfaces@2023-04-01' = {
  name: nicName
  location: location
  properties: {
    ipConfigurations: [
      {
        name: 'ipconfig1'
        properties: {
          subnet: { id: subnetId }
          privateIPAllocationMethod: 'Dynamic'
          publicIPAddress: { id: publicIp.id }
        }
      }
    ]
  }
}

resource vm 'Microsoft.Compute/virtualMachines@2023-03-01' = {
  name: vmName
  location: location
  properties: {
    hardwareProfile: { vmSize: vmSize }
    storageProfile: {
      osDisk: {
        createOption: 'FromImage'
        managedDisk: { storageAccountType: 'Premium_LRS' }
      }
      imageReference: {
        publisher: 'Canonical'
        offer: '0001-com-ubuntu-server-jammy'
        sku: '22_04-lts-gen2'
        version: 'latest'
      }
    }
    networkProfile: {
      networkInterfaces: [ { id: nic.id } ]
    }
    osProfile: {
      computerName: vmName
      adminUsername: adminUsername
      linuxConfiguration: {
        disablePasswordAuthentication: true
        ssh: {
          publicKeys: [
            { path: '/home/${adminUsername}/.ssh/authorized_keys', keyData: sshPublicKey }
          ]
        }
      }
    }
  }
}

output vmId string = vm.id
output publicIpFqdn string = publicIp.properties.dnsSettings.fqdn
output publicIpAddress string = publicIp.properties.ipAddress
