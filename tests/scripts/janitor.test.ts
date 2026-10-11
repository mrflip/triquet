import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Janitor from '../../scripts/janitor'

const Cloud: Janitor.ReachedT = { deployment: 'careful-otter-123', url: 'https://careful-otter-123.convex.cloud' }

describe('deploymentNameOf', () => {
  const NameCases: [string, string, string][] = [
    ['https://careful-otter-123.convex.cloud',  'careful-otter-123', 'a cloud deployment by the name Convex gives it'],
    ['https://careful-otter-123.convex.cloud/', 'careful-otter-123', 'a cloud deployment, its address ending in a slash'],
    ['http://127.0.0.1:3431',                   '127.0.0.1:3431',    'a local backend by its host and port'],
    ['https://convex.example.com',              'convex.example.com', 'any other address by its host'],
  ]
  for (const [url, deployment, blurb] of NameCases) {
    it(blurb, () => {
      expect(Janitor.deploymentNameOf(url)).to.eq(deployment)
    })
  }
  it("refuses what is no address", () => {
    expect(() => Janitor.deploymentNameOf('not an address')).to.throw(TypeError, /Invalid URL/)
  })
})

describe('namedIn', () => {
  it("takes the deployment --deployment names out of the command line", () => {
    expect(Janitor.namedIn(['--deployment', 'careful-otter-123'])).to.deep.eq({ named: 'careful-otter-123', rest: [] })
  })
  it("leaves the command's own flags, in order, wherever --deployment stands among them", () => {
    expect(Janitor.namedIn(['--email', 'pat@example.com', '--deployment', 'careful-otter-123', '--admin'])).to.deep.eq({ named: 'careful-otter-123', rest: ['--email', 'pat@example.com', '--admin'] })
  })
  it("names none for a command line without it", () => {
    expect(Janitor.namedIn(['--email', 'pat@example.com'])).to.deep.eq({ named: undefined, rest: ['--email', 'pat@example.com'] })
    expect(Janitor.namedIn([])).to.deep.eq({ named: undefined, rest: [] })
  })
  it("stops at --deployment with no name after it", () => {
    expect(() => Janitor.namedIn(['--deployment'])).to.throw(Janitor.JanitorStop, /needs the name/)
    expect(() => Janitor.namedIn(['--deployment', '--admin'])).to.throw(Janitor.JanitorStop, /needs the name/)
  })
  it("stops at two deployments", () => {
    expect(() => Janitor.namedIn(['--deployment', 'one', '--deployment', 'two'])).to.throw(Janitor.JanitorStop, /twice/)
  })
})

describe('aimFor', () => {
  it("is a dry run when no deployment is named", () => {
    expect(Janitor.aimFor(undefined, Cloud)).to.deep.eq({ ...Cloud, acting: false, said: 'Aimed at careful-otter-123 (https://careful-otter-123.convex.cloud): a dry run, which changes nothing.' })
  })
  it("acts when the deployment named is the one reached", () => {
    expect(Janitor.aimFor('careful-otter-123', Cloud)).to.deep.eq({ ...Cloud, acting: true, said: 'Aimed at careful-otter-123 (https://careful-otter-123.convex.cloud), as --deployment names it: acting.' })
  })
  it("stops when the deployment named is any other, naming both", () => {
    expect(() => Janitor.aimFor('happy-heron-456', Cloud)).to.throw(Janitor.JanitorStop, /names happy-heron-456, but this environment reaches careful-otter-123/)
  })
  it("stops at the address in place of the name: only the name is taken", () => {
    expect(() => Janitor.aimFor('https://careful-otter-123.convex.cloud', Cloud)).to.throw(Janitor.JanitorStop)
  })
})

describe('dryRunCoda', () => {
  it("says what to add to act on the deployment reached", () => {
    expect(Janitor.dryRunCoda(Cloud)).to.eq('A dry run: nothing was changed. To act on careful-otter-123, run again with --deployment careful-otter-123.')
  })
})

describe('takeAim', () => {
  it("aims at the deployment reached, and hands back the command's own flags", () => {
    const { aim, rest } = Janitor.takeAim(['--deployment', 'careful-otter-123', '--admin'], () => Cloud)
    expect([aim.acting, aim.deployment, rest]).to.deep.eq([true, 'careful-otter-123', ['--admin']])
  })
  it("is a dry run without --deployment", () => {
    expect(Janitor.takeAim([], () => Cloud).aim.acting).to.be.false
  })
  it("stops on a malformed command line before reaching for any deployment", () => {
    let reached = false
    const reach = () => {
      reached = true
      return Cloud
    }
    expect(() => Janitor.takeAim(['--deployment'], reach)).to.throw(Janitor.JanitorStop)
    expect(reached).to.be.false
  })
})

describe('stopOrThrow', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    process.exitCode = undefined
  })
  it("prints a stop's message alone, and exits 1", () => {
    const printed = vi.spyOn(console, 'error').mockImplementation(() => null)
    Janitor.stopOrThrow(new Janitor.JanitorStop('Nothing was done.'))
    expect(printed.mock.calls).to.deep.eq([['Nothing was done.']])
    expect(process.exitCode).to.eq(1)
  })
  it("prints any other failure whole, and exits 1", () => {
    const printed = vi.spyOn(console, 'error').mockImplementation(() => null)
    const err = new Error('Boom')
    Janitor.stopOrThrow(err)
    expect(printed.mock.calls).to.deep.eq([[err]])
    expect(process.exitCode).to.eq(1)
  })
})
