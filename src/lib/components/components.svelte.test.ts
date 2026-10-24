import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import '../../app.css';
import Button from './Button.svelte';
import FormErrors from './FormErrors.svelte';
import Select from './Select.svelte';
import TextField from './TextField.svelte';

const text = (t: string) => createRawSnippet(() => ({ render: () => `<span>${t}</span>` }));

describe('Button', () => {
	it('defaults to type=button and meets the 44px target', async () => {
		render(Button, { children: text('Save') });
		const button = page.getByRole('button', { name: 'Save' });
		await expect.element(button).toHaveAttribute('type', 'button');
		const box = button.element().getBoundingClientRect();
		expect(box.height).toBeGreaterThanOrEqual(44);
	});

	it('passes through type=submit and disabled', async () => {
		render(Button, { children: text('Send'), type: 'submit', disabled: true });
		const button = page.getByRole('button', { name: 'Send' });
		await expect.element(button).toHaveAttribute('type', 'submit');
		await expect.element(button).toBeDisabled();
	});
});

describe('TextField', () => {
	it('labels the input and is valid with no error', async () => {
		render(TextField, { label: 'Name', name: 'name' });
		const input = page.getByLabelText('Name');
		await expect.element(input).toHaveAttribute('id', 'field-name');
		await expect.element(input).not.toHaveAttribute('aria-invalid');
		await expect.element(input).not.toHaveAttribute('aria-describedby');
	});

	it('marks invalid and describes the error and hint', async () => {
		render(TextField, {
			label: 'Name',
			name: 'name',
			error: 'Required',
			hint: 'As on your racquet bag'
		});
		const input = page.getByLabelText('Name');
		await expect.element(input).toHaveAttribute('aria-invalid', 'true');
		await expect.element(input).toHaveAccessibleDescription('Required As on your racquet bag');
	});

	it('meets the 44px target and uses ≥16px text (no iOS zoom)', async () => {
		render(TextField, { label: 'City', name: 'city' });
		const input = page.getByLabelText('City').element();
		expect(input.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
		expect(parseFloat(getComputedStyle(input).fontSize)).toBeGreaterThanOrEqual(16);
	});
});

describe('Select', () => {
	const options = [
		{ value: '3.0', label: 'NTRP 3.0' },
		{ value: '3.5', label: 'NTRP 3.5' }
	];

	it('renders labelled options', async () => {
		render(Select, { label: 'Level', name: 'level', options });
		const select = page.getByLabelText('Level');
		await expect.element(select).toHaveAttribute('id', 'field-level');
		expect(page.getByRole('option').elements()).toHaveLength(2);
	});

	it('marks invalid and describes the error', async () => {
		render(Select, { label: 'Level', name: 'level', options, error: 'Pick a level' });
		const select = page.getByLabelText('Level');
		await expect.element(select).toHaveAttribute('aria-invalid', 'true');
		await expect.element(select).toHaveAccessibleDescription('Pick a level');
	});
});

describe('FormErrors', () => {
	it('renders nothing when there are no errors', async () => {
		render(FormErrors, { errors: {} });
		await expect.element(page.getByRole('region')).not.toBeInTheDocument();
	});

	it('takes focus and links each error to its field', async () => {
		render(FormErrors, {
			errors: { name: 'Required', _form: 'Please try again' },
			labels: { name: 'Name' }
		});
		const summary = page.getByRole('region', { name: "There's a problem" });
		await expect.element(summary).toHaveFocus();
		await expect
			.element(page.getByRole('link', { name: 'Name: Required' }))
			.toHaveAttribute('href', '#field-name');
		await expect.element(page.getByText('Please try again')).toBeVisible();
	});

	it('escapes error text (no HTML injection)', async () => {
		render(FormErrors, { errors: { name: '<img src=x onerror=alert(1)>' } });
		await expect
			.element(page.getByText('<img src=x onerror=alert(1)>', { exact: false }))
			.toBeVisible();
		expect(document.querySelector('img[src="x"]')).toBeNull();
	});
});
