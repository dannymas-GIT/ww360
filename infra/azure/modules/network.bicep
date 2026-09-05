// Network: VNet, subnet, NSG. Production restricts SSH to specified source prefix.
@description('Environment name: dev, staging, prod')
param environment string = 'dev'

@description('Resource name prefix (e.g. aquasafe)')
param namePrefix string = 'aquasafe'

@description('Allowed source prefix for SSH (e.g. 100.64.0.0/10 for Tailscale). Use * for dev only.')
param sshSourceAddressPrefix string = '*'

@description('Location for all resources')
param location string = resourceGroup().location

var nsgName = '${namePrefix}-${environment}-nsg'
var vnetName = '${namePrefix}-${environment}-vnet'
var subnetName = '${namePrefix}-${environment}-subnet'
var subnetPrefix = '10.1.0.0/24'
var addressPrefix = '10.1.0.0/16'

resource nsg 'Microsoft.Network/networkSecurityGroups@2023-04-01' = {
  name: nsgName
  location: location
  properties: {
    securityRules: [
      {
        name: 'SSH'
        properties: {
          priority: 1001
          protocol: 'TCP'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: sshSourceAddressPrefix
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '22'
        }
      }
      {
        name: 'HTTP'
        properties: {
          priority: 1002
          protocol: 'TCP'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '80'
        }
      }
      {
        name: 'HTTPS'
        properties: {
          priority: 1003
          protocol: 'TCP'
          access: 'Allow'
          direction: 'Inbound'
          sourceAddressPrefix: '*'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '443'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-04-01' = {
  name: vnetName
  location: location
  properties: {
    addressSpace: { addressPrefixes: [ addressPrefix ] }
    subnets: [
      {
        name: subnetName
        properties: {
          addressPrefix: subnetPrefix
          networkSecurityGroup: { id: nsg.id }
        }
      }
    ]
  }
}

output nsgId string = nsg.id
output vnetId string = vnet.id
output subnetId string = vnet.properties.subnets[0].id
