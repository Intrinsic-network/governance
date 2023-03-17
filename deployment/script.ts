import { ContractFactory, Overrides } from '@ethersproject/contracts'
import { Signer, Wallet } from 'ethers'

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
  const intInitialAccount = process.env.INT_INITIAL_ACCOUNT_ADDRESS || Wallet.createRandom().privateKey
  log('INT initial account:', intInitialAccount)
  const intMintingAccount = process.env.INT_MINTING_ACCOUNT_ADDRESS || Wallet.createRandom().privateKey
  log('INT minting account:', intMintingAccount)

  const intMintingDelay = process.env.INT_MINTING_DELAY_IN_DAYS
    ? parseInt(process.env.INT_MINTING_DELAY_IN_DAYS, 10)
    : 1
  const mintingAllowedAfter = new Date()
  mintingAllowedAfter.setDate(mintingAllowedAfter.getDate() + intMintingDelay)
  log(`INT minting allowed: ${intMintingDelay} days from deployment`)

  const adminAccount = process.env.ADMIN_ADDRESS || Wallet.createRandom().privateKey
  log('Admin account:', adminAccount)
  const timelockDelay = 60 * 60 * 24 * 2
  log('Timelock delay:', timelockDelay)

  const addresses: Partial<GovernanceAddresses> = {
    int: await deployContract(
      deployer,
      getContractFactory,
      'Int',
      intInitialAccount,
      intMintingAccount,
      mintingAllowedAfter.getTime(),
      { ...overrides }
    ),
    timelock: await deployContract(deployer, getContractFactory, 'Timelock', adminAccount, timelockDelay, {
      ...overrides,
    }),
    governorBravoDelegate: await deployContract(deployer, getContractFactory, 'GovernorBravoDelegate', {
      ...overrides,
    }),
  }

  log()
  const implementationAddress =
    process.env.GOV_BRAVO_IMPLEMENTATION_ADDRESS || addresses.governorBravoDelegate || Wallet.createRandom().privateKey
  log('GovernorBravo initial implementation address:', implementationAddress)

  const votingPeriod = process.env.GOV_BRAVO_VOTING_PERIOD ? parseInt(process.env.GOV_BRAVO_VOTING_PERIOD, 10) : 40_320
  log('GovernorBravo voting period:', votingPeriod)

  const votingDelay = process.env.GOV_BRAVO_VOTING_DELAY ? parseInt(process.env.GOV_BRAVO_VOTING_DELAY, 10) : 1
  log('GovernorBravo voting delay:', votingDelay)

  const proposalThreshold = process.env.GOV_BRAVO_PROPOSAL_THRESHOLD
    ? parseInt(process.env.GOV_BRAVO_PROPOSAL_THRESHOLD, 10)
    : 10_000
  log('GovernorBravo proposal threshold:', proposalThreshold)
  log()

  return {
    ...addresses,
    governorBravoDelegator: await deployContract(
      deployer,
      getContractFactory,
      'GovernorBravoDelegator',
      addresses.timelock,
      addresses.int,
      adminAccount,
      implementationAddress,
      votingPeriod,
      votingDelay,
      proposalThreshold,
      { ...overrides }
    ),
  } as GovernanceAddresses
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
