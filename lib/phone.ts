import { CountryCode, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/min';

export type SupportedPhoneCountry = 'US' | 'IN' | 'GB' | 'AU' | 'JP' | 'DE';

type PhoneCountryConfig = {
	iso2: SupportedPhoneCountry;
	label: string;
	flag: string;
};

export const PHONE_COUNTRIES: PhoneCountryConfig[] = [
	{ iso2: 'US', label: 'United States', flag: '🇺🇸' },
	{ iso2: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
	{ iso2: 'IN', label: 'India', flag: '🇮🇳' },
	{ iso2: 'AU', label: 'Australia', flag: '🇦🇺' },
	{ iso2: 'JP', label: 'Japan', flag: '🇯🇵' },
	{ iso2: 'DE', label: 'Germany', flag: '🇩🇪' },
];

export type NormalizedPhone = {
	country: SupportedPhoneCountry;
	dialCode: string;
	nationalNumber: string;
	e164: string;
};

export function isSupportedPhoneCountry(value: string): value is SupportedPhoneCountry {
	return PHONE_COUNTRIES.some(country => country.iso2 === value);
}

export function getDialCodeForCountry(country: SupportedPhoneCountry): string {
	return `+${getCountryCallingCode(country as CountryCode)}`;
}

function sanitizePhoneInput(input: string): string {
	return input.replace(/\D/g, '');
}

export function normalizePhoneNumber(phoneNumber: string, country: SupportedPhoneCountry): NormalizedPhone | null {
	const sanitized = sanitizePhoneInput(phoneNumber);
	const parsed = parsePhoneNumberFromString(sanitized, country as CountryCode);
	if (!parsed || !parsed.isValid()) {
		return null;
	}

	return {
		country,
		dialCode: getDialCodeForCountry(country),
		nationalNumber: parsed.nationalNumber,
		e164: parsed.number,
	};
}

export function validatePhoneByCountry(phoneNumber: string, country: SupportedPhoneCountry): {
	valid: boolean;
	error?: string;
	normalized?: NormalizedPhone;
} {
	const normalized = normalizePhoneNumber(phoneNumber, country);
	if (!normalized) {
		return {
			valid: false,
			error: 'Please enter a valid phone number for the selected country.',
		};
	}

	return { valid: true, normalized };
}
