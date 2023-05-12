import { ContractFactory, Overrides } from '@ethersproject/contracts'
import { ethers, Signer, Wallet } from 'ethers'
import { getAddress } from 'ethers/lib/utils'

export interface GovernanceAddresses {
  int: string
  timelock: string
  governorBravoDelegate: string
  governorBravoDelegator: string
}

export interface GovernanceDeploymentJSON {
  readonly chainId: number
  readonly addresses: GovernanceAddresses
  readonly deploymentDate: number
}

export const log = (...args: unknown[]): void => {
  console.log(...args)
}

const validateAddress = (address: string | undefined, requiredMessage: string): string => {
  if (!address) {
    throw requiredMessage
  }
  try {
    return getAddress(address)
  } catch (err) {
    throw err
  }
}

const deployContract = async (
  deployer: Signer,
  getContractFactory: (name: string, signer: Signer) => Promise<ContractFactory>,
  contractName: string,
  ...args: unknown[]
) => {
  log()
  log(`Deploying ${contractName} ...`)
  const contractFactory = await getContractFactory(contractName, deployer)

  log(`Successfully fetched contract factory ...`)
  log(`ARGS: ${JSON.stringify(args)}`)
  const contract = await contractFactory.deploy(...args)

  log(`Waiting for transaction ${contract.deployTransaction.hash} ...`)
  const receipt = await contract.deployTransaction.wait()

  log({
    contractAddress: contract.address,
    transactionHash: receipt.transactionHash,
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
  // ---- Deploy Int ---- //

  const intInitialAccount = validateAddress(
    process.env.INT_INITIAL_ACCOUNT_ADDRESS,
    'INT initial account address is required'
  )
  log('INT initial account address:', intInitialAccount)

  const intMinter = validateAddress(process.env.INT_MINTER_ADDRESS, 'INT minter address is required')
  log('INT minter address:', intMinter)

  const intMintingDelay = process.env.INT_MINTING_DELAY_IN_DAYS
    ? parseInt(process.env.INT_MINTING_DELAY_IN_DAYS, 10)
    : 3

  const mintingAllowedAfter = new Date()
  mintingAllowedAfter.setDate(mintingAllowedAfter.getDate() + intMintingDelay)
  log(`INT minting allowed after: ${intMintingDelay} days from deployment`)

  const int = await deployContract(
    deployer,
    getContractFactory,
    'Int',
    intInitialAccount,
    intMinter,
    mintingAllowedAfter.getTime(),
    { ...overrides }
  )

  // ---- Deploy GovernorBravoDelegate ---- //

  const governorBravoDelegate = await deployContract(deployer, getContractFactory, 'GovernorBravoDelegate', {
    ...overrides,
  })

  // ---- Deploy Timelock ---- //

  const admin = process.env.ADMIN_ADDRESS
  log('Timelock admin:', admin)

  const timelockDelay = 60 * 60 * 24 * 2
  log('Timelock delay:', timelockDelay)

  const timelock = await deployContract(deployer, getContractFactory, 'Timelock', admin, timelockDelay, {
    ...overrides,
  })

  // ---- Deploy GovernorBravoDelegator ---- //

  log()
  const implementation = governorBravoDelegate
  log('GovernorBravoDelegator implementation address:', implementation)

  log('GovernorBravoDelegator admin:', admin)

  const votingPeriod = process.env.GOV_BRAVO_VOTING_PERIOD ? parseInt(process.env.GOV_BRAVO_VOTING_PERIOD, 10) : 40_320
  log('GovernorBravoDelegator voting period:', votingPeriod)

  const votingDelay = process.env.GOV_BRAVO_VOTING_DELAY ? parseInt(process.env.GOV_BRAVO_VOTING_DELAY, 10) : 1
  log('GovernorBravoDelegator voting delay:', votingDelay)

  const proposalThreshold = ethers.BigNumber.from(process.env.GOV_BRAVO_PROPOSAL_THRESHOLD || '1000000').mul(
    '1000000000000000000'
  )
  log('GovernorBravoDelegator proposal threshold:', proposalThreshold)
  log()

  const governorBravoDelegator = await deployContract(
    deployer,
    getContractFactory,
    'GovernorBravoDelegator',
    timelock,
    int,
    admin,
    implementation,
    votingPeriod,
    votingDelay,
    proposalThreshold,
    { ...overrides }
  )

  return {
    int,
    governorBravoDelegate,
    timelock,
    governorBravoDelegator,
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
