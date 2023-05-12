import 'hardhat-typechain'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import 'hardhat-typechain'

import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { task, extendEnvironment } from 'hardhat/config'
import { ContractFactory, Overrides, Signer, Wallet } from 'ethers'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

import { deployAndSetupContracts, GovernanceDeploymentJSON } from './deployment/script'

declare module 'hardhat/types/runtime' {
  interface HardhatRuntimeEnvironment {
    deployGovernance: (deployer: Signer, overrides?: Overrides) => Promise<GovernanceDeploymentJSON>
  }
}

dotenv.config()

const deployer = process.env.DEPLOYER_PRIVATE_KEY
if (!deployer) {
  throw 'Deployer is required'
}

const config = {
  networks: {
    hardhat: {
      allowUnlimitedContractSize: false,
    },
    mainnet: {
      url: 'https://public-node.rsk.co',
    },
    testnet: {
      chainId: 31,
      url: 'https://public-node.testnet.rsk.co/',
      accounts: [deployer],
    },
  },
  solidity: {
    version: '0.5.16',
    settings: {
      evmVersion: 'istanbul',
      optimizer: {
        enabled: true,
        runs: 999999,
      },
    },
    outputSelection: {
      '*': {
        '*': [
          'evm.bytecode.object',
          'evm.deployedBytecode.object',
          'abi',
          'evm.bytecode.sourceMap',
          'evm.deployedBytecode.sourceMap',
          'metadata',
        ],
        '': ['ast'],
      },
    },
  },
}

const getContractFactory: (
  env: HardhatRuntimeEnvironment
) => (name: string, signer: Signer) => Promise<ContractFactory> = (env) => env.ethers.getContractFactory

extendEnvironment((env) => {
  env.deployGovernance = async (deployer, overrides?: Overrides) => {
    const deployment = await deployAndSetupContracts(deployer, getContractFactory(env), overrides)
    return deployment
  }
})

task('deploy', 'Deploys the contracts to the network').setAction(async ({}, env) => {
  const overrides = {}
  const [deployer] = await env.ethers.getSigners()
  const deployment = await env.deployGovernance(deployer, overrides)

  fs.mkdirSync(path.join('deployments', 'testnet'), { recursive: true })

  fs.writeFileSync(
    path.join('deployments', 'testnet', `${env.network.name}.json`),
    JSON.stringify(deployment, undefined, 2)
  )

  console.log()
  console.log(deployment)
  console.log()
})

export default config
