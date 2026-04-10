export function useHarvest() {
  const harvest = async (positionId: string) => {
    console.log("Harvesting", positionId)
  }
  return { harvest, isSimulating: false }
}
