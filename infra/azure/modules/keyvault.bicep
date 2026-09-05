// Azure Key Vault for secrets (DB, Redis, JWT, SMTP, etc.).
@description('Environment: dev, staging, prod')
param environment string = 'dev'

@description('Resource name prefix')
param namePrefix string = 'aquasafe'

@description('Object ID of the principal that needs secret get (e.g. VM managed identity or app)')
param accessPolicyObjectId string = ''

@description('Location')
param location string = resourceGroup().location

// Key Vault name: 3-24 chars, alphanumeric and hyphens
var uniqueSuffix = uniqueString(resourceGroup().id)
var kvName = '${namePrefix}-${environment}-${uniqueSuffix}'
var kvNameClean = take(replace(replace(kvName, '-', ''), '_', ''), 24)

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: take(kvNameClean, 24)
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: false
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    accessPolicies: empty(accessPolicyObjectId) ? [] : [
      {
        objectId: accessPolicyObjectId
        permissions: {
          secrets: [ 'get', 'list' ]
          certificates: [ 'get', 'list' ]
        }
        tenantId: subscription().tenantId
      }
    ]
  }
}

output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
