import chai, { expect } from 'chai'
import { Contract, Wallet, providers } from 'ethers'
import { solidity, deployContract } from 'ethereum-waffle'

import Int from '../artifacts/contracts/Int.sol/Int.json'
import Timelock from '../artifacts/contracts/Timelock.sol/Timelock.json'
import GovernorAlpha from '../artifacts/contracts/GovernorAlpha.sol/GovernorAlpha.json'

import { DELAY } from './utils'

chai.use(solidity)

interface GovernanceFixture {
  int: Contract
  timelock: Contract
  governorAlpha: Contract
}

export async function governanceFixture(
  [wallet]: Wallet[],
  provider: providers.Web3Provider
): Promise<GovernanceFixture> {
  // deploy INT, sending the total supply to the deployer
  const { timestamp: now } = await provider.getBlock('latest')
  const timelockAddress = Contract.getContractAddress({ from: wallet.address, nonce: 1 })
  const int = await deployContract(wallet, Int, [wallet.address, timelockAddress, now + 60 * 60])

  // deploy timelock, controlled by what will be the governor
  const governorAlphaAddress = Contract.getContractAddress({ from: wallet.address, nonce: 2 })
  const timelock = await deployContract(wallet, Timelock, [governorAlphaAddress, DELAY])
  expect(timelock.address).to.be.eq(timelockAddress)

  // deploy governorAlpha
  const governorAlpha = await deployContract(wallet, GovernorAlpha, [timelock.address, int.address])
  expect(governorAlpha.address).to.be.eq(governorAlphaAddress)

  return { int, timelock, governorAlpha }
}
