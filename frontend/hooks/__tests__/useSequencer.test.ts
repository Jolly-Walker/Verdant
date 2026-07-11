/**
 * @vitest-environment jsdom
 */

import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import { Connection, VersionedTransaction } from '@solana/web3.js';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSendTransaction } from 'wagmi';
import { fetchWithTimeout } from '@/lib/utils/fetch';
import type {
  BridgeAndDepositParams,
  SerializedSequencePlan,
  SerializedSequenceStep,
} from '@/types/sequencer';
import { useSequencer } from '../useSequencer';
import { useWallet } from '../useWallet';

// External I/O — no live network in tests.
vi.mock('@/lib/utils/fetch', () => ({
  fetchWithTimeout: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useSendTransaction: vi.fn(),
}));

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: vi.fn(),
}));

vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn(),
  VersionedTransaction: { deserialize: vi.fn() },
}));

// Sibling hooks: mock the wallet identity and the demo variant (IS_DEMO is
// false in tests, but the module is still imported at the top of useSequencer).
vi.mock('../useWallet', () => ({
  useWallet: vi.fn(),
}));

vi.mock('../useDemoSequencer', () => ({
  useDemoSequencer: vi.fn(),
}));

const WALLET = '0x1234567890123456789012345678901234567890';

const SERIALIZED_TX = {
  chainId: 42161,
  to: '0x000000000000000000000000000000000000dEaD',
  data: '0xdeadbeef',
  value: '1000000000000000000',
  gasLimit: '210000',
  description: 'Bridge USDC',
};

function makeSerializedStep(overrides: Partial<SerializedSequenceStep>): SerializedSequenceStep {
  return {
    id: 's1',
    label: 'Bridge',
    chain: 'arbitrum',
    status: 'pending',
    dependsOn: [],
    pluginId: 'across',
    buildParams: {
      action: 'supply',
      protocol: 'aave',
      chain: 'arbitrum',
      asset: 'USDC',
      amount: '1000000',
      userAddress: WALLET,
    },
    ...overrides,
  };
}

function makeSerializedPlan(
  stepOverrides: Partial<SerializedSequenceStep>[] = [{}, { id: 's2', dependsOn: ['s1'] }],
  planOverrides: Partial<SerializedSequencePlan> = {},
): SerializedSequencePlan {
  return {
    id: 'plan-1',
    walletAddress: WALLET,
    createdAt: '2026-07-11T00:00:00.000Z',
    status: 'draft',
    totalCostUsd: 12.5,
    description: 'Bridge & deposit',
    templateId: 'bridgeAndDeposit',
    steps: stepOverrides.map(makeSerializedStep),
    ...planOverrides,
  };
}

const BRIDGE_PARAMS: BridgeAndDepositParams = {
  asset: 'USDC',
  amount: '1000000',
  amountUsd: 1000,
  fromChain: 'ethereum',
  toChain: 'arbitrum',
  fromProtocol: 'wallet',
  toProtocol: 'aave',
  walletAddress: WALLET,
  slippagePercent: 0.5,
};

function jsonResponse(body: unknown, ok = true): Response {
  // Minimal Response stand-in — the hook only reads .ok and .json().
  return { ok, json: async () => body } as unknown as Response;
}

function lastFetchBody(callIndex: number): Record<string, unknown> {
  const init = vi.mocked(fetchWithTimeout).mock.calls[callIndex][1];
  return JSON.parse((init as RequestInit).body as string);
}

const sendTransactionAsync = vi.fn();
const signSolanaTransaction = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  vi.mocked(useWallet).mockReturnValue({
    address: WALLET,
  } as unknown as ReturnType<typeof useWallet>);
  vi.mocked(useSendTransaction).mockReturnValue({
    sendTransactionAsync,
  } as unknown as ReturnType<typeof useSendTransaction>);
  vi.mocked(useSolanaWallet).mockReturnValue({
    signTransaction: signSolanaTransaction,
  } as unknown as ReturnType<typeof useSolanaWallet>);
});

/** Renders the hook and seeds it with a deserialized plan via setPlan. */
function renderSeeded(serialized: SerializedSequencePlan = makeSerializedPlan()) {
  const rendered = renderHook(() => useSequencer());
  act(() => {
    rendered.result.current.setPlan(serialized);
  });
  return rendered;
}

describe('useSequencer — createPlan', () => {
  it('POSTs the template body and stores the deserialized plan', async () => {
    const serialized = makeSerializedPlan([
      { unsignedTx: SERIALIZED_TX },
      { id: 's2', dependsOn: ['s1'] },
    ]);
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(jsonResponse({ plan: serialized }));

    const { result } = renderHook(() => useSequencer());

    let created: Awaited<ReturnType<typeof result.current.createPlan>> | undefined;
    await act(async () => {
      created = await result.current.createPlan('bridgeAndDeposit', BRIDGE_PARAMS);
    });

    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetchWithTimeout).mock.calls[0][0]).toBe('/api/sequencer/plan');
    expect(lastFetchBody(0)).toEqual({
      templateId: 'bridgeAndDeposit',
      walletAddress: WALLET,
      params: BRIDGE_PARAMS,
    });

    // Deserialization: ISO date -> Date, string value/gasLimit -> BigInt.
    expect(result.current.plan?.id).toBe('plan-1');
    expect(result.current.plan?.createdAt).toBeInstanceOf(Date);
    expect(result.current.plan?.steps[0].unsignedTx?.value).toBe(1000000000000000000n);
    expect(result.current.plan?.steps[0].unsignedTx?.gasLimit).toBe(210000n);
    expect(created).toBe(result.current.plan);

    // First dependency-free pending step is active.
    expect(result.current.currentStep?.id).toBe('s1');
  });

  it('sends customPlan (not params) for the custom template', async () => {
    const serialized = makeSerializedPlan();
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(jsonResponse({ plan: serialized }));

    const { result } = renderHook(() => useSequencer());
    const customPlan = { steps: [{ id: 's1' }] };
    await act(async () => {
      await result.current.createPlan('custom', { customPlan });
    });

    const body = lastFetchBody(0);
    expect(body.customPlan).toEqual(customPlan);
    expect(body.params).toBeUndefined();
  });

  it('rejects with the server error message and leaves plan null on API failure', async () => {
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(
      jsonResponse({ error: 'Invalid template params' }, false),
    );

    const { result } = renderHook(() => useSequencer());
    await act(async () => {
      await expect(result.current.createPlan('bridgeAndDeposit', BRIDGE_PARAMS)).rejects.toThrow(
        'Invalid template params',
      );
    });
    expect(result.current.plan).toBeNull();
  });

  it('rejects without fetching when the wallet is not connected', async () => {
    vi.mocked(useWallet).mockReturnValue({
      address: undefined,
    } as unknown as ReturnType<typeof useWallet>);

    const { result } = renderHook(() => useSequencer());
    await act(async () => {
      await expect(result.current.createPlan('bridgeAndDeposit', BRIDGE_PARAMS)).rejects.toThrow(
        'Wallet not connected',
      );
    });
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });

  it('wraps non-Error failures in a friendly network message', async () => {
    vi.mocked(fetchWithTimeout).mockRejectedValueOnce('socket hangup');

    const { result } = renderHook(() => useSequencer());
    await act(async () => {
      await expect(result.current.createPlan('bridgeAndDeposit', BRIDGE_PARAMS)).rejects.toThrow(
        'Network error — please check your connection and retry',
      );
    });
  });
});

describe('useSequencer — simulateStep (simulation gate)', () => {
  it('transitions pending -> simulating -> ready and deserializes the simulation result', async () => {
    const { result } = renderSeeded();

    let resolveSim: (r: Response) => void = () => {};
    vi.mocked(fetchWithTimeout).mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveSim = resolve;
      }),
    );

    let simPromise: Promise<unknown> = Promise.resolve();
    act(() => {
      simPromise = result.current.simulateStep('s1');
    });

    // In-flight: step is visibly simulating and the flag is up.
    expect(result.current.plan?.steps[0].status).toBe('simulating');
    expect(result.current.isSimulating).toBe(true);

    const updatedStep = makeSerializedStep({
      status: 'ready',
      unsignedTx: SERIALIZED_TX,
      simulation: {
        success: true,
        gasEstimate: '21000',
        gasCostUsd: 0.42,
        simulatedAt: '2026-07-11T00:01:00.000Z',
      },
    });
    await act(async () => {
      resolveSim(jsonResponse({ updatedStep }));
      await simPromise;
    });

    expect(vi.mocked(fetchWithTimeout).mock.calls[0][0]).toBe('/api/sequencer/simulate');
    expect(lastFetchBody(0)).toEqual({ planId: 'plan-1', stepId: 's1', walletAddress: WALLET });

    const step = result.current.plan?.steps[0];
    expect(step?.status).toBe('ready');
    expect(step?.simulation?.success).toBe(true);
    expect(step?.simulation?.gasEstimate).toBe(21000n);
    expect(step?.simulation?.simulatedAt).toBeInstanceOf(Date);
    expect(result.current.isSimulating).toBe(false);
    await expect(simPromise).resolves.toMatchObject({ success: true });
  });

  it('refuses to simulate a step whose dependencies are not confirmed', async () => {
    const { result } = renderSeeded();

    await act(async () => {
      await expect(result.current.simulateStep('s2')).rejects.toThrow(/unmet dependencies s1/);
    });
    expect(fetchWithTimeout).not.toHaveBeenCalled();
    expect(result.current.plan?.steps[1].status).toBe('pending');
  });

  it('marks the step failed and clears the flag when simulation errors', async () => {
    const { result } = renderSeeded();
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(
      jsonResponse({ error: 'execution reverted' }, false),
    );

    await act(async () => {
      await expect(result.current.simulateStep('s1')).rejects.toThrow('execution reverted');
    });

    expect(result.current.plan?.steps[0].status).toBe('failed');
    expect(result.current.isSimulating).toBe(false);
  });
});

describe('useSequencer — executeStep', () => {
  const readyPlan = () =>
    makeSerializedPlan([
      {
        status: 'ready',
        unsignedTx: SERIALIZED_TX,
        simulation: { success: true, simulatedAt: '2026-07-11T00:01:00.000Z' },
      },
      { id: 's2', dependsOn: ['s1'] },
    ]);

  it('refuses a step that has not passed the simulation gate', async () => {
    const { result } = renderSeeded(); // s1 still 'pending'

    await act(async () => {
      await expect(result.current.executeStep('s1')).rejects.toThrow(
        'Step is not ready to execute',
      );
    });
    expect(fetchWithTimeout).not.toHaveBeenCalled();
    expect(sendTransactionAsync).not.toHaveBeenCalled();
  });

  it('refuses a step with unconfirmed dependencies', async () => {
    const { result } = renderSeeded();

    await act(async () => {
      await expect(result.current.executeStep('s2')).rejects.toThrow(/unmet dependencies s1/);
    });
    expect(sendTransactionAsync).not.toHaveBeenCalled();
  });

  it('PATCHes signing, sends the EVM tx, confirms, and unlocks the next step', async () => {
    const { result } = renderSeeded(readyPlan());
    vi.mocked(fetchWithTimeout).mockResolvedValue(jsonResponse({}));
    sendTransactionAsync.mockResolvedValueOnce('0xtxhash');

    // Nothing is active while s1 awaits its signature.
    expect(result.current.currentStep).toBeNull();

    let txHash = '';
    await act(async () => {
      txHash = await result.current.executeStep('s1');
    });

    expect(txHash).toBe('0xtxhash');
    expect(sendTransactionAsync).toHaveBeenCalledWith({
      to: SERIALIZED_TX.to,
      data: SERIALIZED_TX.data,
      value: 1000000000000000000n,
      chainId: 42161, // arbitrum
    });

    // DB updated before the wallet prompt, then after confirmation.
    const urls = vi.mocked(fetchWithTimeout).mock.calls.map((c) => c[0]);
    expect(urls).toEqual([
      '/api/sequencer/plan/plan-1/step/s1',
      '/api/sequencer/plan/plan-1/step/s1',
    ]);
    expect(lastFetchBody(0)).toMatchObject({ status: 'signing', acknowledged: true });
    expect(lastFetchBody(1)).toMatchObject({ status: 'confirmed', txHash: '0xtxhash' });

    const step = result.current.plan?.steps[0];
    expect(step?.status).toBe('confirmed');
    expect(step?.txHash).toBe('0xtxhash');

    // Only after on-chain confirmation does the dependent step become active.
    expect(result.current.currentStep?.id).toBe('s2');
  });

  it('ignores a second executeStep call while the first is in flight', async () => {
    const { result } = renderSeeded(readyPlan());
    vi.mocked(fetchWithTimeout).mockResolvedValue(jsonResponse({}));

    let resolveTx: (hash: string) => void = () => {};
    sendTransactionAsync.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveTx = resolve;
      }),
    );

    let first: Promise<string> = Promise.resolve('');
    let second: Promise<string> = Promise.resolve('');
    await act(async () => {
      first = result.current.executeStep('s1');
      second = result.current.executeStep('s1');
      await expect(second).resolves.toBe('');
    });

    await act(async () => {
      resolveTx('0xtxhash');
      await expect(first).resolves.toBe('0xtxhash');
    });

    expect(sendTransactionAsync).toHaveBeenCalledTimes(1);
  });

  it('reverts the step to ready when the user rejects the signature', async () => {
    const { result } = renderSeeded(readyPlan());
    vi.mocked(fetchWithTimeout).mockResolvedValue(jsonResponse({}));
    sendTransactionAsync.mockRejectedValueOnce(new Error('User rejected the request'));

    await act(async () => {
      await expect(result.current.executeStep('s1')).rejects.toThrow(
        'Transaction cancelled by user',
      );
    });

    expect(result.current.plan?.steps[0].status).toBe('ready');
    // The revert is persisted to the DB too.
    const patchBodies = vi.mocked(fetchWithTimeout).mock.calls.map((_, i) => lastFetchBody(i));
    expect(patchBodies.at(-1)).toMatchObject({ status: 'ready' });
  });

  it('marks the step failed with a friendly message on broadcast failure', async () => {
    const { result } = renderSeeded(readyPlan());
    vi.mocked(fetchWithTimeout).mockResolvedValue(jsonResponse({}));
    sendTransactionAsync.mockRejectedValueOnce(new Error('nonce too low'));

    await act(async () => {
      await expect(result.current.executeStep('s1')).rejects.toThrow(
        'Network error — please check your connection and retry',
      );
    });

    expect(result.current.plan?.steps[0].status).toBe('failed');
    const patchBodies = vi.mocked(fetchWithTimeout).mock.calls.map((_, i) => lastFetchBody(i));
    expect(patchBodies.at(-1)).toMatchObject({ status: 'failed' });
  });

  it('reverts to ready with the desync message when the signing PATCH fails', async () => {
    const { result } = renderSeeded(readyPlan());
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(jsonResponse({}, false));

    await act(async () => {
      await expect(result.current.executeStep('s1')).rejects.toThrow(/State desynchronization/);
    });

    // The wallet is never prompted, the step returns to 'ready', and the
    // generic catch must not overwrite that with a 'failed' PATCH.
    expect(sendTransactionAsync).not.toHaveBeenCalled();
    expect(result.current.plan?.steps[0].status).toBe('ready');
    expect(fetchWithTimeout).toHaveBeenCalledTimes(1);
  });

  it('keeps the step confirmed when the tx lands on-chain but the confirm PATCH fails', async () => {
    const { result } = renderSeeded(readyPlan());
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce(jsonResponse({})) // signing PATCH
      .mockResolvedValueOnce(jsonResponse({}, false)); // confirm PATCH
    sendTransactionAsync.mockResolvedValueOnce('0xtxhash');

    await act(async () => {
      await expect(result.current.executeStep('s1')).rejects.toThrow(
        /Transaction successful on-chain/,
      );
    });

    // The on-chain result must win locally — never re-marked 'failed'.
    const step = result.current.plan?.steps[0];
    expect(step?.status).toBe('confirmed');
    expect(step?.txHash).toBe('0xtxhash');
    expect(fetchWithTimeout).toHaveBeenCalledTimes(2);
  });

  it('signs and broadcasts through the Solana wallet for solana steps', async () => {
    const solanaPlan = makeSerializedPlan([
      {
        chain: 'solana',
        status: 'ready',
        unsignedTx: {
          ...SERIALIZED_TX,
          chainId: 'solana-mainnet',
          data: Buffer.from([1, 2, 3]).toString('base64'),
        },
        simulation: { success: true, simulatedAt: '2026-07-11T00:01:00.000Z' },
      },
    ]);
    const { result } = renderSeeded(solanaPlan);
    vi.mocked(fetchWithTimeout).mockResolvedValue(jsonResponse({}));

    const fakeUnsigned = { kind: 'versioned-tx' };
    vi.mocked(VersionedTransaction.deserialize).mockReturnValueOnce(
      fakeUnsigned as unknown as VersionedTransaction,
    );
    const signedBytes = new Uint8Array([9, 9, 9]);
    signSolanaTransaction.mockResolvedValueOnce({ serialize: () => signedBytes });
    const sendRawTransaction = vi.fn().mockResolvedValueOnce('solTxHash');
    const confirmTransaction = vi.fn().mockResolvedValueOnce({});
    // Regular function (not arrow) so the mocked class can be `new`-ed.
    vi.mocked(Connection).mockImplementationOnce(function connectionStub() {
      return { sendRawTransaction, confirmTransaction } as unknown as Connection;
    });

    let txHash = '';
    await act(async () => {
      txHash = await result.current.executeStep('s1');
    });

    expect(txHash).toBe('solTxHash');
    expect(signSolanaTransaction).toHaveBeenCalledWith(fakeUnsigned);
    expect(sendRawTransaction).toHaveBeenCalledWith(signedBytes);
    expect(confirmTransaction).toHaveBeenCalledWith('solTxHash');
    expect(sendTransactionAsync).not.toHaveBeenCalled();
    expect(result.current.plan?.steps[0].status).toBe('confirmed');
  });
});

describe('useSequencer — signStep, setPlan, reset', () => {
  it('signStep confirms the step locally and persists to the DB', async () => {
    const { result } = renderSeeded();
    vi.mocked(fetchWithTimeout).mockResolvedValueOnce(jsonResponse({}));

    await act(async () => {
      await result.current.signStep('s1', '0xexternal');
    });

    expect(vi.mocked(fetchWithTimeout).mock.calls[0][0]).toBe('/api/sequencer/plan/plan-1/step/s1');
    expect(lastFetchBody(0)).toMatchObject({ status: 'confirmed', txHash: '0xexternal' });
    expect(result.current.plan?.steps[0]).toMatchObject({
      status: 'confirmed',
      txHash: '0xexternal',
    });
  });

  it('setPlan deserializes serialized plans, passes live plans through, and reset clears', () => {
    const { result } = renderHook(() => useSequencer());

    act(() => {
      result.current.setPlan(makeSerializedPlan([{ unsignedTx: SERIALIZED_TX }]));
    });
    expect(result.current.plan?.createdAt).toBeInstanceOf(Date);
    expect(result.current.plan?.steps[0].unsignedTx?.value).toBe(1000000000000000000n);

    const livePlan = result.current.plan;
    act(() => {
      result.current.setPlan(livePlan);
    });
    expect(result.current.plan).toBe(livePlan);

    act(() => {
      result.current.reset();
    });
    expect(result.current.plan).toBeNull();
  });
});
