import { ClassicPreset } from 'rete';
import { SolidityType } from './solc-type-extractor';

// Base node class for all Solidity nodes
export class SolidityNode extends ClassicPreset.Node {
  width = 180;
  height = 120;
  
  constructor(label: string) {
    super(label);
  }
}

// Socket types for different data types
export class SoliditySocket extends ClassicPreset.Socket {
  constructor(public solidityType: SolidityType) {
    super(solidityType.name);
  }
}

// Control for input fields
export class SolidityControl extends ClassicPreset.InputControl<'text'> {
  constructor(public key: string, initial?: string, public placeholder?: string) {
    super('text', { initial: initial || '' });
  }
}

// State Variable Nodes
export class UintVariableNode extends SolidityNode {
  constructor() {
    super('Uint Variable');
    
    this.addControl('name', new SolidityControl('name', '', 'Variable name'));
    this.addControl('value', new SolidityControl('value', '0', 'Initial value'));
    this.addControl('visibility', new SolidityControl('visibility', 'public', 'Visibility'));
    
    this.addOutput('value', new ClassicPreset.Output(new SoliditySocket({ name: 'uint256', type: 'elementary', baseType: 'integer' })));
  }
}

export class AddressVariableNode extends SolidityNode {
  constructor() {
    super('Address Variable');
    
    this.addControl('name', new SolidityControl('name', '', 'Variable name'));
    this.addControl('value', new SolidityControl('value', 'address(0)', 'Initial value'));
    this.addControl('visibility', new SolidityControl('visibility', 'public', 'Visibility'));
    
    this.addOutput('value', new ClassicPreset.Output(new SoliditySocket({ name: 'address', type: 'elementary', baseType: 'address' })));
  }
}

export class BoolVariableNode extends SolidityNode {
  constructor() {
    super('Bool Variable');
    
    this.addControl('name', new SolidityControl('name', '', 'Variable name'));
    this.addControl('value', new SolidityControl('value', 'false', 'Initial value'));
    this.addControl('visibility', new SolidityControl('visibility', 'public', 'Visibility'));
    
    this.addOutput('value', new ClassicPreset.Output(new SoliditySocket({ name: 'bool', type: 'elementary', baseType: 'boolean' })));
  }
}

export class StringVariableNode extends SolidityNode {
  constructor() {
    super('String Variable');
    
    this.addControl('name', new SolidityControl('name', '', 'Variable name'));
    this.addControl('value', new SolidityControl('value', '""', 'Initial value'));
    this.addControl('visibility', new SolidityControl('visibility', 'public', 'Visibility'));
    
    this.addOutput('value', new ClassicPreset.Output(new SoliditySocket({ name: 'string', type: 'elementary', baseType: 'string' })));
  }
}

export class MappingVariableNode extends SolidityNode {
  constructor() {
    super('Mapping Variable');
    
    this.addControl('name', new SolidityControl('name', '', 'Variable name'));
    this.addControl('keyType', new SolidityControl('keyType', 'address', 'Key type'));
    this.addControl('valueType', new SolidityControl('valueType', 'uint256', 'Value type'));
    this.addControl('visibility', new SolidityControl('visibility', 'public', 'Visibility'));
    
    this.addOutput('value', new ClassicPreset.Output(new SoliditySocket({ 
      name: 'mapping', 
      type: 'mapping', 
      keyType: 'address', 
      valueType: 'uint256' 
    })));
  }
}

// Function Nodes
export class ConstructorFunctionNode extends SolidityNode {
  constructor() {
    super('Constructor');
    
    this.addControl('parameters', new SolidityControl('parameters', '', 'Parameters (type name, ...)'));
    this.addControl('modifiers', new SolidityControl('modifiers', '', 'Modifiers'));
    
    this.addInput('execution', new ClassicPreset.Input(new SoliditySocket({ name: 'execution', type: 'elementary' })));
    this.addOutput('execution', new ClassicPreset.Output(new SoliditySocket({ name: 'execution', type: 'elementary' })));
  }
}

export class PublicFunctionNode extends SolidityNode {
  constructor() {
    super('Public Function');
    
    this.addControl('name', new SolidityControl('name', '', 'Function name'));
    this.addControl('parameters', new SolidityControl('parameters', '', 'Parameters (type name, ...)'));
    this.addControl('returns', new SolidityControl('returns', '', 'Return types'));
    this.addControl('modifiers', new SolidityControl('modifiers', '', 'Modifiers'));
    
    this.addInput('execution', new ClassicPreset.Input(new SoliditySocket({ name: 'execution', type: 'elementary' })));
    this.addOutput('execution', new ClassicPreset.Output(new SoliditySocket({ name: 'execution', type: 'elementary' })));
  }
}

export class PrivateFunctionNode extends SolidityNode {
  constructor() {
    super('Private Function');
    
    this.addControl('name', new SolidityControl('name', '', 'Function name'));
    this.addControl('parameters', new SolidityControl('parameters', '', 'Parameters (type name, ...)'));
    this.addControl('returns', new SolidityControl('returns', '', 'Return types'));
    this.addControl('modifiers', new SolidityControl('modifiers', '', 'Modifiers'));
    
    this.addInput('execution', new ClassicPreset.Input(new SoliditySocket({ name: 'execution', type: 'elementary' })));
    this.addOutput('execution', new ClassicPreset.Output(new SoliditySocket({ name: 'execution', type: 'elementary' })));
  }
}

export class ViewFunctionNode extends SolidityNode {
  constructor() {
    super('View Function');
    
    this.addControl('name', new SolidityControl('name', '', 'Function name'));
    this.addControl('parameters', new SolidityControl('parameters', '', 'Parameters (type name, ...)'));
    this.addControl('returns', new SolidityControl('returns', '', 'Return types'));
    this.addControl('modifiers', new SolidityControl('modifiers', '', 'Modifiers'));
    
    this.addInput('execution', new ClassicPreset.Input(new SoliditySocket({ name: 'execution', type: 'elementary' })));
    this.addOutput('execution', new ClassicPreset.Output(new SoliditySocket({ name: 'execution', type: 'elementary' })));
  }
}

export class PayableFunctionNode extends SolidityNode {
  constructor() {
    super('Payable Function');
    
    this.addControl('name', new SolidityControl('name', '', 'Function name'));
    this.addControl('parameters', new SolidityControl('parameters', '', 'Parameters (type name, ...)'));
    this.addControl('returns', new SolidityControl('returns', '', 'Return types'));
    this.addControl('modifiers', new SolidityControl('modifiers', '', 'Modifiers'));
    
    this.addInput('execution', new ClassicPreset.Input(new SoliditySocket({ name: 'execution', type: 'elementary' })));
    this.addOutput('execution', new ClassicPreset.Output(new SoliditySocket({ name: 'execution', type: 'elementary' })));
  }
}

// Event Node
export class EventNode extends SolidityNode {
  constructor() {
    super('Event');
    
    this.addControl('name', new SolidityControl('name', '', 'Event name'));
    this.addControl('parameters', new SolidityControl('parameters', '', 'Parameters (type name indexed?, ...)'));
    
    this.addInput('trigger', new ClassicPreset.Input(new SoliditySocket({ name: 'execution', type: 'elementary' })));
  }
}

// Template Nodes
export class ERC20TemplateNode extends SolidityNode {
  constructor() {
    super('ERC20 Token');
    this.width = 220;
    this.height = 160;
    
    this.addControl('name', new SolidityControl('name', 'MyToken', 'Token name'));
    this.addControl('symbol', new SolidityControl('symbol', 'MTK', 'Token symbol'));
    this.addControl('decimals', new SolidityControl('decimals', '18', 'Decimals'));
    this.addControl('totalSupply', new SolidityControl('totalSupply', '1000000', 'Total supply'));
    
    this.addOutput('contract', new ClassicPreset.Output(new SoliditySocket({ name: 'ERC20', type: 'contract' })));
  }
}

export class ERC721TemplateNode extends SolidityNode {
  constructor() {
    super('ERC721 NFT');
    this.width = 220;
    this.height = 160;
    
    this.addControl('name', new SolidityControl('name', 'MyNFT', 'NFT name'));
    this.addControl('symbol', new SolidityControl('symbol', 'MNFT', 'NFT symbol'));
    this.addControl('baseURI', new SolidityControl('baseURI', '', 'Base URI'));
    
    this.addOutput('contract', new ClassicPreset.Output(new SoliditySocket({ name: 'ERC721', type: 'contract' })));
  }
}

// Node factory function
export function createNode(nodeType: string): SolidityNode | null {
  switch (nodeType) {
    // State Variables
    case 'uint-variable':
      return new UintVariableNode();
    case 'address-variable':
      return new AddressVariableNode();
    case 'bool-variable':
      return new BoolVariableNode();
    case 'string-variable':
      return new StringVariableNode();
    case 'mapping-variable':
      return new MappingVariableNode();
    
    // Functions
    case 'constructor-function':
      return new ConstructorFunctionNode();
    case 'public-function':
      return new PublicFunctionNode();
    case 'private-function':
      return new PrivateFunctionNode();
    case 'view-function':
      return new ViewFunctionNode();
    case 'payable-function':
      return new PayableFunctionNode();
    
    // Events
    case 'event':
      return new EventNode();
    
    // Templates
    case 'erc20-template':
      return new ERC20TemplateNode();
    case 'erc721-template':
      return new ERC721TemplateNode();
    
    default:
      return null;
  }
}

// Get all available node types
export function getAvailableNodeTypes(): string[] {
  return [
    'uint-variable',
    'address-variable',
    'bool-variable',
    'string-variable',
    'mapping-variable',
    'constructor-function',
    'public-function',
    'private-function',
    'view-function',
    'payable-function',
    'event',
    'erc20-template',
    'erc721-template'
  ];
}