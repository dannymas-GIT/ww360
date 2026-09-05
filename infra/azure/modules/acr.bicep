// Azure Container Registry for AquaSafe images (shared across environments or per-env).
@description('Resource name prefix; ACR name must be globally unique, alphanumeric only')
param namePrefix string = 'aquasafe'

@description('Location')
param location string = resourceGroup().location

var acrName = '${namePrefix}acr${uniqueString(resourceGroup().id)}'
var acrNameClean = replace(take(replace(acrName, '-', ''), 50), '_', '')

resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name: acrNameClean
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: true
    publicNetworkAccess: 'Enabled'
  }
}

output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output acrId string = acr.id
