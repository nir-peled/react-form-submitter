import type { BaseSyntheticEvent } from "react";
import { useState, useCallback } from "react";

interface UseSubmitterParams<
	T extends Record<string, unknown>,
	D extends Record<string, unknown> = T,
	FetchOptions extends RequestInit = RequestInit,
	TDefaults extends Partial<D> | undefined = undefined
> {
	default_values?: TDefaults;
	reset?: (data?: Partial<T> | undefined) => void;
	method?: string;
	on_success?: (data: Partial<D>, response?: Response) => void;
	on_error?: (e: unknown) => void;
	transform?: (data: T) => D;
	fetch_options?: FetchOptions;
	confirmation?: string;
	mutate?: (data: D) => void;
}

/**
 * Create a function that submits form data to an endpoint, and
 * handles default values, form reset and failed flag
 *
 * @param endpoint the endpoint to submit to
 * @param is_failed the current form failed flag
 * @param set_is_failed form failed flag setter
 * @param default_values the form's default values - submit only values not in here
 * @param reset form reset hook
 * @param method fetch HTTP method - default is POST
 * @param on_success callback on successful submit
 * @param on_error callback on error thrown
 * @param transform function to transform the data before checks and submission
 * @param fetch_options options for `fetch`
 * @param confirmation if included, use `confirm` with this message, and only move forward if confirmed
 * @param mutate data mutation hook
 * @returns the submitter function to use with handleSubmit
 */
export function useSubmitter<
	T extends Record<string, unknown>,
	D extends Record<string, unknown> = T,
	FetchOptions extends RequestInit = RequestInit,
	TDefaults extends Partial<D> | undefined = undefined
>(
	destination:
		| string
		| ((
				data: TDefaults extends undefined ? D : Partial<D>
		  ) => boolean | Promise<boolean>),
	{
		default_values,
		reset,
		method = "POST",
		on_success,
		on_error,
		transform,
		fetch_options,
		confirmation,
		mutate,
	}: UseSubmitterParams<T, D, FetchOptions, TDefaults>
): {
	is_failed: boolean;
	submitter: (data: T, event?: BaseSyntheticEvent) => Promise<void>;
} {
	const [is_failed, set_is_failed] = useState<boolean>(false);

	const submitter = useCallback(
		async (data: T, event?: BaseSyntheticEvent) => {
			if (event) event.preventDefault();
			let transed_data = (transform ? transform(data) : data) as D;

			let submit_ok = false;
			let response: Response | undefined;
			if (confirmation && !confirm(confirmation)) return;
			try {
				if (typeof destination == "string") {
					let form_data = await to_form_data_without_default(
						transed_data,
						default_values
					);
					response = await fetch(destination, {
						method,
						body: form_data,
						...fetch_options,
					});
					submit_ok = response && response.ok;
				} else {
					submit_ok = await destination(
						await without_defaults(transed_data, default_values)
					);
				}
			} catch (e) {
				if (on_error) on_error(e);
			} finally {
				if (submit_ok) {
					set_is_failed(false);
					if (reset) reset();
					if (on_success) on_success(transed_data, response);
					if (mutate) mutate_data(mutate, transed_data, default_values);
				} else {
					set_is_failed(true);
					if (reset) reset(data);
				}
			}
		},
		[
			is_failed,
			default_values,
			reset,
			method,
			on_success,
			on_error,
			transform,
			fetch_options,
			confirmation,
			mutate,
		]
	);

	return { is_failed, submitter };
}

async function to_form_data_without_default<T extends Record<string, unknown>>(
	data: T,
	default_data?: Partial<T>
): Promise<FormData> {
	let form_data = new FormData();
	for (let [key, value] of Object.entries(data)) {
		if (!default_data || !(await is_same_values(value, default_data[key as keyof T]))) {
			const form_value =
				typeof value == "string" || value instanceof File ? value : JSON.stringify(value);
			form_data.append(key, form_value);
		}
	}

	return form_data;
}

async function without_defaults<T extends Record<string, unknown>>(
	values: T,
	default_values?: Partial<T>
): Promise<typeof default_values extends undefined ? T : Partial<T>> {
	if (!default_values) return values;

	let submit_values: Partial<T> = {};
	for (let [key, value] of Object.entries(values)) {
		if (!(await is_same_values(value, default_values[key as keyof T])))
			submit_values[key as keyof T] = value as T[keyof T];
	}

	return submit_values as any;
}

async function is_same_values<T, D>(value: T, default_value: D): Promise<boolean> {
	if (!default_value) return false;
	if (value instanceof File) {
		if (!(default_value instanceof File)) return false;
		return await is_same_files(value, default_value as File);
	}

	return value === default_value;
}

async function is_same_files(file: File, default_file: File): Promise<boolean> {
	return (
		file.name === default_file.name &&
		file.size === default_file.size &&
		file.type === default_file.type &&
		file.lastModified === default_file.lastModified
	);
}

async function mutate_data<T extends Record<string, unknown>>(
	mutate: (data: T) => void,
	data: T,
	default_values: Partial<T> | undefined
) {
	if (!default_values) {
		mutate(data);
		return;
	}

	let new_data = default_values as T;
	for (let key of Object.keys(default_values!)) {
		let old_value = new_data[key as keyof T];
		let new_value = data[key as keyof T];
		if (old_value == undefined || new_value == undefined) {
			new_data[key as keyof T] = new_value as T[keyof T];
		}
	}

	mutate(new_data);
}
