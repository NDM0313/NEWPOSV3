# Numbering Consolidation

- **erp_document_sequences** is canonical for document numbering (PAY, JE, PUR, SL, etc.). Use `generate_document_number` RPC or `documentNumberService.getNextDocumentNumber(companyId, branchId, 'payment')` for all new payment paths.
- **document_sequences** and **document_sequences_global** are legacy/alternate. Still used by credit notes, refunds, returns until migrated. Do not use for new PAY; freeze for payment refs.
- No new payment path should use legacy numbering for PAY. All canonical flows (supplierPaymentService, workerPaymentService, AccountingContext manual/expense, testAccountingService) already use documentNumberService → erp_document_sequences.
