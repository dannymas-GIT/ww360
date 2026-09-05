// Network with an extra delegated subnet for PostgreSQL Flexible Server (Phase 3).
@description('Environment: staging or prod')
param environment string = 'staging'

@description('Resource name prefix')
param namePrefix string = 'aquasafe'

@description('SSH source prefix; use * for dev')
param sshSourceAddressPrefix string = '*'

@description('Location')
param location string = resourceGroup().location

var nsgName = '${namePrefix}-${environment}-nsg'
var vnetName = '${namePrefix}-${environment}-vnet'
var appSubnetName = '${namePrefix}-${environment}-app'
var pgSubnetName = '${namePrefix}-${environment}-pg'
var appSubnetPrefix = '10.1.0.0/24'
var pgSubnetPrefix = '10.1.1.0/24'
var addressPrefix = '10.1.0.0/16'

resource nsg 'Microsoft.Network/networkSecurityGroups@2023-04-01' = {
  name: nsgName
  location: location
  properties: {
    securityRules: [
      { name: 'SSH', properties: { priority: 1001, protocol: 'TCP', access: 'Allow', direction: 'Inbound', sourceAddressPrefix: sshSourceAddressPrefix, sourcePortRange: '*', destinationAddressPrefix: '*', destinationPortRange: '22' } }
      { name: 'HTTP', properties: { priority: 1002, protocol: 'TCP', access: 'Allow', direction: 'Inbound', sourceAddressPrefix: '*', sourcePortRange: '*', destinationAddressPrefix: '*', destinationPortRange: '80' } }
      { name: 'HTTPS', properties: { priority: 1003, protocol: 'TCP', access: 'Allow', direction: 'Inbound', sourceAddressPrefix: '*', sourcePortRange: '*', destinationAddressPrefix: '*', destinationPortRange: '443' } }
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
        name: appSubnetName
        properties: {
          addressPrefix: appSubnetPrefix
          networkSecurityGroup: { id: nsg.id }
        }
      }
      {
        name: pgSubnetName
        properties: {
          addressPrefix: pgSubnetPrefix
          delegations: [
            {
              name: 'pg-delegation'
              properties: {
                serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
              }
            }
          ]
        }
      }
    ]
  }
}

output nsgId string = nsg.id
output vnetId string = vnet.id
output appSubnetId string = vnet.properties.subnets[0].id
output pgSubnetId string = vnet.properties.subnets[1].id
