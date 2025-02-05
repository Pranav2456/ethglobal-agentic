export const COMMANDS = {
    CREATE_WALLET: 'create wallet',
    DEPOSIT: 'deposit',
    WITHDRAW: 'withdraw',
    BALANCE: 'balance',
    ANALYZE: 'analyze markets',
    POSITION: 'analyze position',
    HELP: 'help',
    EXIT: 'exit'
};

export const COMMAND_DESCRIPTIONS = {
    [COMMANDS.CREATE_WALLET]: 'Create a new agent wallet',
    [COMMANDS.DEPOSIT]: 'Get deposit instructions',
    [COMMANDS.WITHDRAW]: 'Withdraw funds from your wallet',
    [COMMANDS.BALANCE]: 'Check your wallet balance',
    [COMMANDS.ANALYZE]: 'Show current market analysis',
    [COMMANDS.POSITION]: 'Check your current position',
    [COMMANDS.HELP]: 'Show available commands',
    [COMMANDS.EXIT]: 'Exit application'
};