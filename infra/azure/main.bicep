@description('WW360 staging resource group deployment')
param location string = resourceGroup().location
param vmName string = 'ww360-staging-vm'
param adminUsername string = 'azureuser'
param dnsLabel string = 'ww360-staging'

module network 'modules/network.bicep' = {
  name: 'ww360-network'
  params: {
    location: location
    vnetName: 'ww360-vnet'
    nsgName: 'ww360-nsg'
  }
}

module vm 'modules/vm.bicep' = {
  name: 'ww360-vm'
  params: {
    location: location
    vmName: vmName
    adminUsername: adminUsername
    subnetId: network.outputs.subnetId
    dnsLabel: dnsLabel
  }
}

module keyvault 'modules/keyvault.bicep' = {
  name: 'ww360-kv'
  params: {
    location: location
    keyVaultName: 'ww360-staging-kv'
  }
}

module storage 'modules/storage.bicep' = {
  name: 'ww360-storage'
  params: {
    location: location
    storageAccountName: 'ww360stagingbk'
  }
}

output vmPublicIp string = vm.outputs.publicIpAddress
output keyVaultUri string = keyvault.outputs.keyVaultUri
