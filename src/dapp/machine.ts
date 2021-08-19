import { createMachine, Interpreter, EventObject, interpret, assign } from 'xstate';
import { Charity } from './types/contract'
import { BlockChain } from './Blockchain';

export interface Context {
    blockChain: BlockChain
    errorCode?: 'NO_WEB3' | 'WRONG_CHAIN'
}

const hasFarm = (
    { blockChain }: Context,
) => {
    return blockChain.isTrial ||  blockChain.hasFarm
};

export interface FarmCreatedEvent extends EventObject {
    type: 'FARM_CREATED';
}

export interface NetworkChangedEvent extends EventObject {
    type: 'NETWORK_CHANGED';
}

export interface GetStartedEvent extends EventObject {
    type: 'GET_STARTED';
}

export interface SaveEvent extends EventObject {
    type: 'SAVE';
}

export interface TrialEvent extends EventObject {
    type: 'TRIAL';
}


export interface DonateEvent extends EventObject {
    type: 'DONATE';
    charity: Charity
}

export interface UpgradeEvent extends EventObject {
    type: 'UPGRADE';
}

export type BlockchainEvent =
    | FarmCreatedEvent
    | NetworkChangedEvent
    | GetStartedEvent
    | SaveEvent
    | UpgradeEvent
    | DonateEvent
    | TrialEvent


export type BlockchainState = {
    value:
        'loading'
        | 'initial'
        | 'registering'
        | 'creating'
        | 'farming'
        | 'failure'
        | 'upgrading'
        | 'saving'
    context: Context;
};

export type BlockchainInterpreter = Interpreter<
        Context,
        any,
        BlockchainEvent,
        BlockchainState
    >
export const blockChainMachine = createMachine<
    Context,
    BlockchainEvent,
    BlockchainState
>({
    id: 'farmMachine',
    initial: 'initial',
    context: {
        blockChain: new BlockChain(),
        errorCode: null,
    },
    states: {
        initial: {
            on: {
                GET_STARTED: {
                    target: 'loading',
                },
            }
        },
        loading: {
            invoke: {
                src: ({ blockChain }) => blockChain.initialise(),
                onDone: [
                    {
                        target: 'farming',
                        cond: hasFarm,
                    },
                    {
                        target: 'registering'
                    }
                ],
                onError: {
                    target: 'failure',
                    actions:  assign({
                        errorCode: (context, event) => event.data.message,
                    }),
                },
            },
        },
        registering: {
            on: {
                DONATE: {
                    target: 'creating',
                },
            }
        },
        creating: {
            invoke: {
                src: ({ blockChain }, event) => blockChain.createFarm((event as DonateEvent).charity),
                onDone: {
                    target: 'farming',
                },
                onError: {
                    target: 'failure',
                    actions:  assign({
                        errorCode: (context, event) => event.data.message,
                    }),
                },
            },
        },
        farming: {
            on: {
                SAVE: {
                    target: 'saving',
                },
                UPGRADE: {
                    target: 'upgrading'
                }
            }
        },
        saving: {
            invoke: {
                id: 'save',
                src: async ({ blockChain }, event) => blockChain.save(),
                onDone: {
                    target: 'farming',
                    // actions - assign() data?
                },
                onError: {
                    target: 'failure',
                }
            }
        },
        upgrading: {
            invoke: {
                id: 'upgrading',
                src: async ({ blockChain }) => {
                    await blockChain.levelUp()
                },
                onDone: {
                    target: 'farming',
                },
                onError: {
                    target: 'failure',
                }
            }
        },
        failure: {
            on: {
                NETWORK_CHANGED: {
                    target: 'loading',
                },
                TRIAL: {
                    target: 'farming',
                    actions: (context) => { context.blockChain.startTrialMode() }
                }
            }
        }
    }
  });

export const service = interpret<Context,
    any,
    BlockchainEvent,
    BlockchainState
>(blockChainMachine)

service.start()
