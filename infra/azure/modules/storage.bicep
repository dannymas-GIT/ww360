// Azure Storage Account for backups and optional static assets.
@description('Environment: dev, staging, prod')
param environment string = 'dev'

@description('Resource name prefix')
param namePrefix string = 'aquasafe'

@description('Location')
param location string = resourceGroup().location

// Storage account names: 3-24 chars, lowercase alphanumeric only
var uniqueSuffix = uniqueString(resourceGroup().id)
var baseName = replace('${namePrefix}${environment}', '-', '')
var saName = take(toLower('${baseName}${uniqueSuffix}'), 24)

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: saName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {}
}

resource backupsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'ww360-backups'
  properties: {
    publicAccess: 'None'
  }
}

output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
output backupsContainerName string = 'ww360-backups'
