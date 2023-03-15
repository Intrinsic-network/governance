import { ContractFactory, Overrides } from '@ethersproject/contracts'
import { Signer } from 'ethers'

export interface GovernanceAddresses {
  int: string
  timelock: string
  governorAlpha: string
  governorBravo?: string
}

export interface GovernanceDeploymentJSON {
  readonly chainId: number
  readonly addresses: GovernanceAddresses
  readonly deploymentDate: number
}

export const log = (...args: unknown[]): void => {
  console.log(...args)
}

const deployContract = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  contractName: string,
  ...args: unknown[]
) => {
  log(`Deploying ${contractName} ...`)
  const contractFactory = await getContractFactory(contractName, deployer)

  log(`Successfully fetched contract factory ...`)
  log(`ARGS: ${JSON.stringify(args)}`)
  const contract = await contractFactory.deploy(...args)

  log(`Waiting for transaction ${contract.deployTransaction.hash} ...`)
  const receipt = await contract.deployTransaction.wait()

  log({
    contractAddress: contract.address,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toNumber(),
  })

  log()

  return contract.address
}

const deployContracts = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  overrides?: Overrides
): Promise<GovernanceAddresses> => {
  const now = new Date().getTime()
  const signer = await deployer.getAddress()
  const DELAY = 60 * 60 * 24 * 2

  const addresses = {
    int: await deployContract(deployer, getContractFactory, 'Int', signer, signer, now + 60 * 60, { ...overrides }),
    timelock: await deployContract(deployer, getContractFactory, 'Timelock', signer, DELAY, { ...overrides }),
  }

  return {
    ...addresses,
    governorAlpha: await deployContract(
      deployer,
      getContractFactory,
      'contracts/GovernorAlpha.sol:GovernorAlpha',
      addresses.timelock,
      addresses.int,
      { ...overrides }
    ),
  }
}

export const deployAndSetupContracts = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  overrides?: Overrides
): Promise<GovernanceDeploymentJSON> => {
  if (!deployer.provider) {
    throw new Error('Signer must have a provider.')
  }

  log('Deploying contracts...')
  log()

  const deployment: GovernanceDeploymentJSON = {
    chainId: await deployer.getChainId(),
    deploymentDate: new Date().getTime(),
    addresses: await deployContracts(deployer, getContractFactory, overrides),
  }

  return deployment
}
