// AquaSafe deployment including Azure PostgreSQL Flexible Server (Phase 3).
// Use this when migrating from containerized Postgres to managed DB.
@description('Environment: staging or prod')
param environment string = 'staging'

@description('Resource name prefix')
param namePrefix string = 'aquasafe'

@description('SSH public key for VM')
param sshPublicKey string

@description('Inbound SSH source for NSG. Default * — see main.bicep sshSourceAddressPrefix comment.')
param sshSourceAddressPrefix string = '*'

@description('VM size')
param vmSize string = 'Standard_D2s_v3'

@description('PostgreSQL admin login')
param postgresAdminLogin string = 'aquasafeadmin'

@secure()
@description('PostgreSQL admin password')
param postgresAdminPassword string

@description('Postgres SKU (e.g. Standard_D2s_v3)')
param postgresSkuName string = 'Standard_D2s_v3'

@description('Postgres storage GB')
param postgresStorageGb int = 128

@description('Key Vault access policy object ID (optional)')
param keyVaultAccessPolicyObjectId string = ''

@description('Location')
param location string = resourceGroup().location

module network 'modules/network-with-pg-subnet.bicep' = {
  name: 'network-with-pg'
  params: {
    environment: environment
    namePrefix: namePrefix
    location: location
    sshSourceAddressPrefix: sshSourceAddressPrefix
  }
}

module storage 'modules/storage.bicep' = {
  name: 'storage'
  params: { environment: environment, namePrefix: namePrefix, location: location }
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
  params: { namePrefix: namePrefix, location: location }
}

module vm 'modules/vm.bicep' = {
  name: 'vm'
  params: {
    environment: environment
    namePrefix: namePrefix
    vmSize: vmSize
    subnetId: network.outputs.appSubnetId
    sshPublicKey: sshPublicKey
    location: location
  }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    environment: environment
    namePrefix: namePrefix
    subnetId: network.outputs.pgSubnetId
    administratorLogin: postgresAdminLogin
    administratorPassword: postgresAdminPassword
    skuName: postgresSkuName
    storageSizeGb: postgresStorageGb
    tier: 'GeneralPurpose'
    version: '15'
    location: location
  }
}

output vmPublicFqdn string = vm.outputs.publicIpFqdn
output vmPublicIp string = vm.outputs.publicIpAddress
output postgresFqdn string = postgres.outputs.serverFqdn
output postgresServerName string = postgres.outputs.serverName
output storageAccountName string = storage.outputs.storageAccountName
output keyVaultUri string = keyvault.outputs.keyVaultUri
output acrLoginServer string = acr.outputs.acrLoginServer
