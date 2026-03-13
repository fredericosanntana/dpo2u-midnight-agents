// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ZKComplianceVerifier
 * @notice Verificador de provas de conformidade ZK (Zero-Knowledge)
 * @dev FASE 1: Commitment hash verification
 *       FASE 2: zk-SNARK verification (circom)
 *
 * Este contrato permite que empresas provem conformidade com LGPD/GDPR
 * SEM expor dados sensíveis, usando commitment hashes ou zk-SNARKs.
 *
 * Integration: ERC-8004 AgentRegistry para armazenar provas on-chain
 */
contract ZKComplianceVerifier {
    // Structs
    struct ComplianceProof {
        bytes32 proofHash;           // Hash da prova (keccak256)
        address company;              // Endereço da empresa (0x0 se off-chain)
        uint256 score;               // Score de compliance (0-100)
        uint256 threshold;           // Threshold mínimo exigido
        uint256 timestamp;           // Timestamp da prova
        string cid;                  // CID IPFS do documento completo
        bool verified;              // Se a prova foi verificada
        ProofType proofType;         // Tipo de prova
    }

    enum ProofType {
        COMMITMENT,     // FASE 1: Commitment hash
        ZKSNARK         // FASE 2: zk-SNARK real
    }

    // State
    mapping(bytes32 => ComplianceProof) public proofs;
    bytes32[] public proofHashes;

    // Events
    event ProofVerified(
        bytes32 indexed proofHash,
        address indexed company,
        uint256 score,
        uint256 threshold,
        string cid,
        ProofType proofType
    );

    event ProofRevoked(
        bytes32 indexed proofHash,
        address indexed company,
        string reason
    );

    // Errors
    error InvalidProofFormat();
    error ProofExpired();
    error ProofAlreadyVerified();
    error UnauthorizedProofRevocation();

    /**
     * @notice Verifica e registra uma prova de conformidade
     * @param proofHash Hash da prova (keccak256(proof + commitment + cid))
     * @param company Endereço da empresa (0x0 para anonimato)
     * @param score Score de compliance (extraído dos public signals)
     * @param threshold Threshold mínimo exigido
     * @param cid CID IPFS do documento completo (relatório + metadata)
     * @param proofType Tipo de prova (commitment ou zksnark)
     */
    function verifyAndStoreProof(
        bytes32 proofHash,
        address company,
        uint256 score,
        uint256 threshold,
        string calldata cid,
        ProofType proofType
    ) external returns (uint256) {
        // Validar formato
        if (proofHash == bytes32(0)) {
            revert InvalidProofFormat();
        }

        // Verificar se prova já existe
        if (proofs[proofHash].verified) {
            revert ProofAlreadyVerified();
        }

        // Criar struct da prova
        ComplianceProof memory newProof = ComplianceProof({
            proofHash: proofHash,
            company: company,
            score: score,
            threshold: threshold,
            timestamp: block.timestamp,
            cid: cid,
            verified: true,
            proofType: proofType
        });

        // Armazenar prova
        proofs[proofHash] = newProof;
        proofHashes.push(proofHash);

        // Emitir evento
        emit ProofVerified(
            proofHash,
            company,
            score,
            threshold,
            cid,
            proofType
        );

        return proofHashes.length - 1; // Retornar índice
    }

    /**
     * @notice Verifica uma prova sem armazenar (view function)
     * @param proofHash Hash da prova
     * @return valid Se a prova é válida
     * @return score Score da prova
     * @return aboveThreshold Se está acima do threshold
     */
    function checkProof(
        bytes32 proofHash
    ) external view returns (
        bool valid,
        uint256 score,
        bool aboveThreshold
    ) {
        ComplianceProof memory proof = proofs[proofHash];

        // Prova não existe ou não foi verificada
        if (!proof.verified) {
            return (false, 0, false);
        }

        // Verificar se expirou (24 horas)
        uint256 MAX_PROOF_AGE = 24 hours;
        if (block.timestamp > proof.timestamp + MAX_PROOF_AGE) {
            return (false, proof.score, false);
        }

        // Verificar se está acima do threshold
        bool above = proof.score >= proof.threshold;

        return (true, proof.score, above);
    }

    /**
     * @notice Revoga uma prova (apenas pelo criador)
     * @param proofHash Hash da prova a revogar
     * @param reason Razão da revogação
     */
    function revokeProof(
        bytes32 proofHash,
        string calldata reason
    ) external {
        ComplianceProof storage proof = proofs[proofHash];

        // Verificar se prova existe
        if (!proof.verified) {
            revert InvalidProofFormat();
        }

        // Apenas o criador pode revogar
        if (proof.company != msg.sender && proof.company != address(0)) {
            revert UnauthorizedProofRevocation();
        }

        // Marcar como revogada
        proof.verified = false;

        emit ProofRevoked(proofHash, msg.sender, reason);
    }

    /**
     * @notice Obtém informações de uma prova
     * @param proofHash Hash da prova
     */
    function getProof(
        bytes32 proofHash
    ) external view returns (ComplianceProof memory) {
        return proofs[proofHash];
    }

    /**
     * @notice Retorna todas as provas de uma empresa
     * @param company Endereço da empresa
     */
    function getProofsByCompany(
        address company
    ) external view returns (bytes32[] memory) {
        bytes32[] memory companyProofs = new bytes32[](proofHashes.length);
        uint256 count = 0;

        for (uint256 i = 0; i < proofHashes.length; i++) {
            bytes32 hash = proofHashes[i];
            if (proofs[hash].company == company) {
                companyProofs[count] = hash;
                count++;
            }
        }

        // Redimensionar array para o tamanho real
        bytes32[] memory result = new bytes32[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = companyProofs[i];
        }

        return result;
    }

    /**
     * @notice Retorna o número total de provas registradas
     */
    function getTotalProofs() external view returns (uint256) {
        return proofHashes.length;
    }

    /**
     * @notice Verifica se uma prova está expirada
     * @param proofHash Hash da prova
     */
    function isProofExpired(bytes32 proofHash) external view returns (bool) {
        ComplianceProof memory proof = proofs[proofHash];

        if (!proof.verified) {
            return true;
        }

        uint256 MAX_PROOF_AGE = 24 hours;
        return block.timestamp > proof.timestamp + MAX_PROOF_AGE;
    }

    /**
     * @notice Retorna provas válidas (não expiradas)
     * @param company Endereço da empresa (opcional)
     */
    function getValidProofs(
        address company
    ) external view returns (bytes32[] memory) {
        uint256 validCount = 0;

        // Primeira passagem: contar provas válidas
        for (uint256 i = 0; i < proofHashes.length; i++) {
            bytes32 hash = proofHashes[i];
            if (proofs[hash].verified && proofs[hash].company == company) {
                uint256 MAX_PROOF_AGE = 24 hours;
                if (block.timestamp <= proofs[hash].timestamp + MAX_PROOF_AGE) {
                    validCount++;
                }
            }
        }

        // Segunda passagem: coletar provas válidas
        bytes32[] memory validProofs = new bytes32[](validCount);
        uint256 index = 0;

        for (uint256 i = 0; i < proofHashes.length; i++) {
            bytes32 hash = proofHashes[i];
            if (proofs[hash].verified && proofs[hash].company == company) {
                uint256 MAX_PROOF_AGE = 24 hours;
                if (block.timestamp <= proofs[hash].timestamp + MAX_PROOF_AGE) {
                    validProofs[index] = hash;
                    index++;
                }
            }
        }

        return validProofs;
    }

    /**
     * @notice Calcula hash da prova para verificação
     * @dev Este helper permite que off-chain code calcule o mesmo hash
     * @param proofData Dados da prova (JSON string)
     * @param commitmentHash Hash do commitment dos dados privados
     * @param cid CID IPFS do documento
     */
    function calculateProofHash(
        string calldata proofData,
        bytes32 commitmentHash,
        string calldata cid
    ) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(proofData, commitmentHash, cid));
    }

    /**
     * @dev FASE 2: Integração com zk-SNARK verifier
     * Este método será adicionado quando tivermos o circuito circom compilado
     */
    // function verifyZKSnarkProof(
    //     uint[8] calldata proof,
    //     uint[1] calldata publicSignals,
    //     bytes32 vkHash  // Hash do verifying key
    // ) external pure returns (bool) {
    //     // TODO: Implementar verificação zk-SNARK
    //     // Requer circuito circom compilado + pairing checker
    // }
}

/**
 * @title ZKComplianceWithRegistry
 * @notice Extensão do verifier com integração ERC-8004 AgentRegistry
 */
contract ZKComplianceWithRegistry is ZKComplianceVerifier {
    // AgentRegistry interface (ERC-8004)
    IAgentRegistry public immutable agentRegistry;

    constructor(address _agentRegistry) {
        agentRegistry = IAgentRegistry(_agentRegistry);
    }

    /**
     * @notice Verifica e registra prova diretamente no AgentRegistry
     * @param agentId ID do agente (ex: 3 = dpo2u-compliance-expert)
     * @param proofHash Hash da prova
     * @param cid CID IPFS do documento
     */
    function verifyAndRegisterToAgent(
        uint256 agentId,
        bytes32 proofHash,
        string calldata cid
    ) external returns (uint256) {
        // Verificar proof no contrato base
        // (os parâmetros seriam passados pelo cliente)
        // Registrar no AgentRegistry
        agentRegistry.registerComplianceProof(agentId, proofHash, cid);

        return proofHashes.length - 1;
    }
}

/**
 * @title IAgentRegistry
 * @notice Interface do ERC-8004 AgentRegistry
 */
interface IAgentRegistry {
    function registerComplianceProof(
        uint256 agentId,
        bytes32 proofHash,
        string calldata cid
    ) external;
}
