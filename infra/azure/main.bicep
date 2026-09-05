// WW360 Azure main deployment: network, VM, storage, Key Vault, ACR.
// Dedicated resource group for state ownership transfer.
@description('Environment: staging, prod')
param environment string = 'staging'

@description('Resource name prefix')
param namePrefix string = 'ww360'

@description('SSH public key for VM admin')
param sshPublicKey string

@description('Inbound SSH source for NSG')
param sshSourceAddressPrefix string = '*'

@description('VM size')
param vmSize string = 'Standard_B2s'

@description('Object ID for Key Vault access policy (optional)')
param keyVaultAccessPolicyObjectId string = ''

@description('Location')
param location string = resourceGroup().location

module network 'modules/network.bicep' = {
  name: 'network'
  params: {
    environment: environment
    namePrefix: namePrefix
    location: location
    sshSourceAddressPrefix: sshSourceAddressPrefix
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: {
    environment: environment
    namePrefix: namePrefix
    location: location
  }
}

module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    environment: environment
    namePrefix: namePrefix
    location: location
    accessPolicyObjectId: keyVaultAccessPolicyObjectId
  }
}

module acr 'modules/acr.bicep' = {
  name: 'acr'
  params: {
    namePrefix: namePrefix
    location: location
  }
}

module vm 'modules/vm.bicep' = {
  name: 'vm'
  params: {
    environment: environment
    namePrefix: namePrefix
    vmSize: vmSize
    subnetId: network.outputs.subnetId
    sshPublicKey: sshPublicKey
    location: location
  }
}

output vmPublicFqdn string = vm.outputs.publicIpFqdn
output vmPublicIp string = vm.outputs.publicIpAddress
output storageAccountName string = storage.outputs.storageAccountName
output keyVaultUri string = keyvault.outputs.keyVaultUri
output acrLoginServer string = acr.outputs.acrLoginServer
output acrName string = acr.outputs.acrName
