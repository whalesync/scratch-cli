export enum Flavor {
    Local = 'local',
    Test = 'test',
    Staging = 'staging',
    Production = 'production',
  }
  
  export function getBuildFlavor(): Flavor {
    // The flavor comes from a property specified in the docker file.
    const flavor = process.env.NEXT_PUBLIC_APP_ENV;
    switch (flavor) {
      case 'production':
        return Flavor.Production;
      case 'staging':
        return Flavor.Staging;
      case 'test':
        return Flavor.Test;
      case 'local':
        return Flavor.Local;
      default:
        return Flavor.Local;
    }
  }

  export function isLocalBuild(): boolean {
    return getBuildFlavor() === Flavor.Local;
  }