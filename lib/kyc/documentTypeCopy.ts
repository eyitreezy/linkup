import type { KycDocumentType } from '@/types/kyc';

export function idCaptureTitle(documentType: KycDocumentType): string {
  switch (documentType) {
    case 'passport':
      return 'Passport';
    case 'drivers_license':
      return "Driver's license";
    case 'voters_card':
      return "Voter's card";
    case 'national_id':
    default:
      return 'National ID';
  }
}

/** Primary capture instruction (camera overlay / hero). */
export function idCaptureInstruction(documentType: KycDocumentType): string {
  switch (documentType) {
    case 'passport':
      return 'Capture the photo page of your passport';
    case 'drivers_license':
      return "Capture the front of your driver's license";
    case 'voters_card':
      return "Capture your voter's card clearly";
    case 'national_id':
    default:
      return 'Capture your national ID clearly';
  }
}
