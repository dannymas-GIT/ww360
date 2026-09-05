// Azure Database for PostgreSQL Flexible Server (optional; use when moving off containerized DB).
@description('Environment: staging or prod')
param environment string = 'staging'

@description('Resource name prefix')
param namePrefix string = 'aquasafe'

@description('Subnet ID for private access (delegated subnet)')
param subnetId string

@description('Administrator login')
param administratorLogin string = 'aquasafeadmin'

@description('Administrator password')
@secure()
param administratorPassword string

@description('SKU name (e.g. Standard_D2s_v3)')
param skuName string = 'Standard_D2s_v3'

@description('Tier: Burstable, GeneralPurpose, MemoryOptimized')
param tier string = 'GeneralPurpose'

@description('Storage size in GB')
param storageSizeGb int = 128

@description('PostgreSQL version')
param version string = '15'

@description('Location')
param location string = resourceGroup().location

var serverName = '${namePrefix}-${environment}-pg'

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: serverName
  location: location
  sku: {
    name: skuName
    tier: tier
  }
  properties: {
    version: version
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: {
      storageSizeGB: storageSizeGb
    }
    backup: {
      backupRetentionDays: environment == 'prod' ? 35 : 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: environment == 'prod' ? 'ZoneRedundant' : 'Disabled'
    }
    network: {
      delegatedSubnetResourceId: subnetId
      // Set privateDnsZoneArmResourceId when using private DNS for the flexible server
    }
  }
}

output serverName string = postgres.name
output serverFqdn string = postgres.properties.fullyQualifiedDomainName
output postgresId string = postgres.id
