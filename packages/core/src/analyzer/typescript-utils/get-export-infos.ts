import { findDeclaration } from './find-declaration';
import * as TypeScript from 'typescript';
import { TypescriptExport } from './typescript-export';
import { TypeScriptType } from './typescript-type';
import * as Types from '../../types';

export function getExportInfos(
	program: TypeScript.Program,
	statement: TypeScript.Statement
): TypescriptExport[] {
	const typechecker = program.getTypeChecker();

	const modifiers = statement.modifiers;
	const isDefault =
		modifiers &&
		modifiers.some(modifier => modifier.kind === TypeScript.SyntaxKind.DefaultKeyword);

	const jsDocTags = TypeScript.getJSDocTags(statement);
	const exportIgnore = jsDocTags.some(tag => tag.tagName.escapedText === 'ignore');

	const nameTag = jsDocTags.find(tag => tag.tagName.escapedText === 'name');

	const descriptionTag = jsDocTags.find(tag => tag.tagName.escapedText === 'description');
	const exportDescription = descriptionTag ? descriptionTag.comment : '';

	const iconTag = jsDocTags.find(tag => tag.tagName.escapedText === 'icon');
	const exportIcon = iconTag ? iconTag.comment : '';

	const exportPatternTypeTag = jsDocTags.find(tag => tag.tagName.escapedText === 'patternType');
	const exportPatternType = exportPatternTypeTag
		? (exportPatternTypeTag.comment as Types.SerializedPatternType)
		: 'pattern';

	if (TypeScript.isVariableStatement(statement)) {
		for (const declaration of statement.declarationList.declarations) {
			if (!declaration.type) {
				continue;
			}

			const type = typechecker.getTypeAtLocation(declaration);
			const exportType = new TypeScriptType(type, typechecker);
			const exportName = isDefault ? undefined : declaration.name.getText();
			const exportDisplayName = nameTag ? nameTag.comment : undefined;

			return [
				{
					exportName,
					displayName: exportDisplayName,
					description: exportDescription || '',
					icon: exportIcon || '',
					type: exportType,
					patternType: exportPatternType,
					ignore: exportIgnore,
					statement
				}
			];
		}
	}

	if (TypeScript.isClassDeclaration(statement)) {
		if (!statement.name) {
			return [];
		}

		const type = typechecker.getTypeAtLocation(statement);
		const exportType = new TypeScriptType(type, typechecker);
		const exportName = isDefault ? undefined : statement.name.getText();
		const exportDisplayName = nameTag ? nameTag.comment : undefined;

		return [
			{
				exportName,
				displayName: exportDisplayName,
				description: exportDescription || '',
				icon: exportIcon || '',
				type: exportType,
				patternType: exportPatternType,
				ignore: exportIgnore,
				statement
			}
		];
	}

	if (TypeScript.isExportAssignment(statement)) {
		const expression = statement.expression;
		const declaration = findDeclaration(expression);

		if (declaration) {
			const type = typechecker.getTypeAtLocation(declaration);
			const exportType = new TypeScriptType(type, typechecker);
			const exportDisplayName = nameTag ? nameTag.comment : undefined;

			return [
				{
					exportName: undefined,
					displayName: exportDisplayName,
					description: exportDescription || '',
					icon: exportIcon || '',
					type: exportType,
					patternType: exportPatternType,
					ignore: exportIgnore,
					statement
				}
			];
		}
	}

	if (TypeScript.isExportDeclaration(statement)) {
		if (!statement.exportClause) {
			return [];
		}

		return statement.exportClause.elements.map(exportSpecifier => {
			const type = typechecker.getTypeAtLocation(exportSpecifier);
			const exportType = new TypeScriptType(type, typechecker);
			const exportName = isDefault ? undefined : exportSpecifier.name.getText();
			const exportDisplayName = nameTag ? nameTag.comment : undefined;

			return {
				exportName,
				displayName: exportDisplayName,
				description: exportDescription || '',
				icon: exportIcon || '',
				type: exportType,
				patternType: exportPatternType,
				ignore: exportIgnore,
				statement
			};
		});
	}

	return [];
}
