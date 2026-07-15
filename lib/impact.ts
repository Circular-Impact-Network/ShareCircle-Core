import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * User-level sharing impact.
 *
 * Source of truth is the `v_cin_user_impact_summary` Postgres view (defined in Supabase),
 * which aggregates per-transaction impact from `v_cin_transaction_impact` using the
 * cin_* reference tables (category emission factors, retail values, attribution rates,
 * data-gap/confidence handling). Being a regular view, it always reflects live data —
 * any change to transactions/items/factors is picked up on the next read, no refresh needed.
 *
 * We read the aggregate columns rather than recomputing anything client-side.
 */

export interface UserImpact {
	itemsShared: number;
	timesLent: number;
	timesBorrowed: number;
	moneySavedUsd: number;
	co2AvoidedKg: number;
}

const EMPTY_IMPACT: UserImpact = {
	itemsShared: 0,
	timesLent: 0,
	timesBorrowed: 0,
	moneySavedUsd: 0,
	co2AvoidedKg: 0,
};

export interface CircleImpact {
	circleId: string;
	circleName: string | null;
	totalMembers: number;
	totalBorrows: number;
	uniqueBorrowers: number;
	uniqueLenders: number;
	ghgSavedKg: number;
	weightDivertedKg: number;
	borrowerSavingsUsd: number;
	retailValueSharedUsd: number;
	repeatBorrowerRate: number;
}

export interface CircleMemberImpact {
	userId: string;
	userName: string | null;
	memberRole: string;
	borrowsInCircle: number;
	lendsInCircle: number;
	ghgSavedKg: number;
	savingsUsd: number;
	valueSharedUsd: number;
}

export interface TransactionImpact {
	ghgSavedKg: number;
	weightDivertedKg: number;
	borrowerSavingsUsd: number;
	impactConfidence: string | null;
	hasDataGaps: boolean;
}

/** Circle-level impact summary (visible to every member). Reads v_cin_circle_impact_summary. */
export async function getCircleImpact(circleId: string): Promise<CircleImpact | null> {
	try {
		const rows = await prisma.$queryRaw<CircleImpact[]>`
			SELECT
				circle_id                              AS "circleId",
				circle_name                            AS "circleName",
				COALESCE(total_members, 0)::int        AS "totalMembers",
				COALESCE(total_borrows, 0)::int        AS "totalBorrows",
				COALESCE(unique_borrowers, 0)::int     AS "uniqueBorrowers",
				COALESCE(unique_lenders, 0)::int       AS "uniqueLenders",
				COALESCE(total_ghg_saved_kg_co2e, 0)::float8      AS "ghgSavedKg",
				COALESCE(total_weight_diverted_kg, 0)::float8     AS "weightDivertedKg",
				COALESCE(total_borrower_savings_usd, 0)::float8   AS "borrowerSavingsUsd",
				COALESCE(total_retail_value_shared_usd, 0)::float8 AS "retailValueSharedUsd",
				COALESCE(repeat_borrower_rate, 0)::float8         AS "repeatBorrowerRate"
			FROM v_cin_circle_impact_summary
			WHERE circle_id = ${circleId}
			LIMIT 1
		`;
		return rows[0] ?? null;
	} catch (err) {
		console.error('Impact: v_cin_circle_impact_summary unavailable:', err);
		return null;
	}
}

/** Per-member breakdown within a circle (admin-only surface). Reads v_cin_circle_member_breakdown. */
export async function getCircleMemberBreakdown(circleId: string): Promise<CircleMemberImpact[]> {
	try {
		return await prisma.$queryRaw<CircleMemberImpact[]>`
			SELECT
				user_id                                   AS "userId",
				user_name                                 AS "userName",
				member_role::text                         AS "memberRole",
				COALESCE(borrows_in_circle, 0)::int       AS "borrowsInCircle",
				COALESCE(lends_in_circle, 0)::int         AS "lendsInCircle",
				COALESCE(ghg_saved_in_circle_kg_co2e, 0)::float8 AS "ghgSavedKg",
				COALESCE(savings_in_circle_usd, 0)::float8       AS "savingsUsd",
				COALESCE(value_shared_in_circle_usd, 0)::float8  AS "valueSharedUsd"
			FROM v_cin_circle_member_breakdown
			WHERE circle_id = ${circleId}
			ORDER BY ghg_saved_in_circle_kg_co2e DESC NULLS LAST, lends_in_circle DESC
		`;
	} catch (err) {
		console.error('Impact: v_cin_circle_member_breakdown unavailable:', err);
		return [];
	}
}

/** Batch per-transaction impact keyed by transaction id. Reads v_cin_transaction_impact. */
export async function getTransactionImpacts(transactionIds: string[]): Promise<Map<string, TransactionImpact>> {
	const map = new Map<string, TransactionImpact>();
	if (transactionIds.length === 0) return map;
	try {
		const rows = await prisma.$queryRaw<(TransactionImpact & { transactionId: string })[]>`
			SELECT
				transaction_id                          AS "transactionId",
				COALESCE(ghg_saved_kg_co2e, 0)::float8   AS "ghgSavedKg",
				COALESCE(weight_diverted_kg, 0)::float8  AS "weightDivertedKg",
				COALESCE(borrower_savings_usd, 0)::float8 AS "borrowerSavingsUsd",
				impact_confidence                       AS "impactConfidence",
				COALESCE(has_data_gaps, false)          AS "hasDataGaps"
			FROM v_cin_transaction_impact
			WHERE transaction_id IN (${Prisma.join(transactionIds)})
		`;
		for (const row of rows) {
			const { transactionId, ...rest } = row;
			map.set(transactionId, rest);
		}
		return map;
	} catch (err) {
		console.error('Impact: v_cin_transaction_impact unavailable:', err);
		return map;
	}
}

export async function getUserImpact(userId: string): Promise<UserImpact> {
	try {
		// Cast bigint/numeric columns to float8/int so they return as JS numbers (not BigInt/string).
		const rows = await prisma.$queryRaw<
			{
				itemsShared: number;
				timesLent: number;
				timesBorrowed: number;
				moneySavedUsd: number;
				co2AvoidedKg: number;
			}[]
		>`
			SELECT
				COALESCE(total_items_listed, 0)::int         AS "itemsShared",
				COALESCE(total_lends, 0)::int                AS "timesLent",
				COALESCE(total_borrows, 0)::int              AS "timesBorrowed",
				COALESCE(total_borrower_savings_usd, 0)::float8 AS "moneySavedUsd",
				COALESCE(total_ghg_saved_kg_co2e, 0)::float8    AS "co2AvoidedKg"
			FROM v_cin_user_impact_summary
			WHERE user_id = ${userId}
			LIMIT 1
		`;

		// A user with no activity has no row in the view — that's zero impact, not an error.
		const row = rows[0];
		if (!row) return EMPTY_IMPACT;

		return {
			itemsShared: row.itemsShared,
			timesLent: row.timesLent,
			timesBorrowed: row.timesBorrowed,
			moneySavedUsd: Math.round(row.moneySavedUsd),
			co2AvoidedKg: Math.round(row.co2AvoidedKg * 10) / 10,
		};
	} catch (err) {
		// If the view isn't present (e.g. a local DB without the cin_* views), degrade to zeros
		// rather than failing the dashboard.
		console.error('Impact: v_cin_user_impact_summary unavailable:', err);
		return EMPTY_IMPACT;
	}
}
