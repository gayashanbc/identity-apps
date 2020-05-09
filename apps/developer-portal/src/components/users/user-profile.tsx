/**
 * Copyright (c) 2020, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License
 */

import { AlertInterface, AlertLevels, TestableComponentInterface } from "@wso2is/core/models";
import { Field, Forms } from "@wso2is/forms";
import { ConfirmationModal, DangerZone, DangerZoneGroup } from "@wso2is/react-components";
import _ from "lodash";
import React, { FunctionComponent, ReactElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { Button, Divider, Form, Grid, Input } from "semantic-ui-react";
import { deleteUser, updateUserInfo } from "../../api";
import { history } from "../../helpers";
import { AuthStateInterface, BasicProfileInterface, ProfileSchema } from "../../models";
import { AppState } from "../../store";
import { flattenSchemas } from "../../utils";

/**
 * Prop types for the basic details component.
 */
interface UserProfilePropsInterface extends TestableComponentInterface {
    onAlertFired: (alert: AlertInterface) => void;
    user: BasicProfileInterface;
    handleUserUpdate: (userId: string) => void;
}

/**
 * Basic details component.
 *
 * @param {UserProfilePropsInterface} props - Props injected to the basic details component.
 * @return {ReactElement}
 */
export const UserProfile: FunctionComponent<UserProfilePropsInterface> = (
    props: UserProfilePropsInterface
): ReactElement => {

    const {
        onAlertFired,
        user,
        handleUserUpdate,
        [ "data-testid" ]: testId
    } = props;

    const { t } = useTranslation();

    const [ profileInfo, setProfileInfo ] = useState(new Map<string, string>());
    const [ profileSchema, setProfileSchema ] = useState<ProfileSchema[]>();
    const [ urlSchema, setUrlSchema ] = useState<ProfileSchema>();
    const [ showDeleteConfirmationModal, setShowDeleteConfirmationModal ] = useState<boolean>(false);
    const [ deletingUser, setDeletingUser ] = useState<BasicProfileInterface>(undefined);
    const profileDetails: AuthStateInterface = useSelector((state: AppState) => state.authenticationInformation);

    /**
     * The following function maps profile details to the SCIM schemas.
     *
     * @param proSchema ProfileSchema
     * @param userInfo BasicProfileInterface
     */
    const mapUserToSchema = (proSchema: ProfileSchema[], userInfo: BasicProfileInterface): void => {
        if (!_.isEmpty(profileSchema) && !_.isEmpty(userInfo)) {
            const tempProfileInfo: Map<string, string> = new Map<string, string>();

            proSchema.forEach((schema: ProfileSchema) => {
                const schemaNames = schema.name.split(".");

                if (schemaNames.length === 1) {
                    if (schemaNames[0] === "emails") {
                        if (userInfo?.hasOwnProperty(schemaNames[0]) && userInfo[schemaNames[0]][0]) {
                            userInfo[[schemaNames[0]][0]][0].value &&
                                userInfo[[schemaNames[0]][0]][0].value !== "" ? tempProfileInfo.set(schema.name,
                                    userInfo[[schemaNames[0]][0]][0].value as string)
                                : tempProfileInfo.set(schema.name, userInfo[schemaNames[0]][0] as string);
                        }
                    } else {
                        tempProfileInfo.set(schema.name, userInfo[schemaNames[0]]);
                    }
                } else {
                    if (schemaNames[0] === "name") {
                        const name = schemaNames[1] && userInfo[schemaNames[0]] &&
                            userInfo[schemaNames[0]][schemaNames[1]] && (
                                tempProfileInfo.set(schema.name, userInfo[schemaNames[0]][schemaNames[1]])
                            );
                    } else {
                        const subValue = userInfo[schemaNames[0]]
                            && userInfo[schemaNames[0]]
                                .find((subAttribute) => subAttribute.type === schemaNames[1]);
                        tempProfileInfo.set(
                            schema.name,
                            subValue ? subValue.value : ""
                        );
                    }
                }
            });

            setProfileInfo(tempProfileInfo);
        }
    };

    /**
     * Sort the elements of the profileSchema state according by the displayOrder attribute in the ascending order.
     */
    useEffect(() => {
        const sortedSchemas = flattenSchemas([...profileDetails.profileSchemas])
            .sort((a: ProfileSchema, b: ProfileSchema) => {
                if (!a.displayOrder) {
                    return -1;
                } else if (!b.displayOrder) {
                    return 1;
                } else {
                    return parseInt(a.displayOrder, 10) - parseInt(b.displayOrder, 10);
                }
            });

        setProfileSchema(sortedSchemas);

        const url = sortedSchemas.filter((schema: ProfileSchema) => {
            return schema.name === "profileUrl";
        });

        if (sortedSchemas.length > 0) {
            setUrlSchema(url[0]);
        }

    }, [profileDetails.profileSchemas]);

    useEffect(() => {
        mapUserToSchema(profileSchema, user);
    }, [profileSchema, user]);

    /**
     * This function handles deletion of the user.
     *
     * @param userId
     */
    const handleUserDelete = (userId: string): void => {
        deleteUser(userId)
            .then(() => {
                onAlertFired({
                    description: t(
                        "devPortal:components.users.notifications.deleteUser.success.description"
                    ),
                    level: AlertLevels.SUCCESS,
                    message: t(
                        "devPortal:components.users.notifications.deleteUser.success.message"
                    )
                });
                history.push("/users");
            });
    };

    /**
     * The following method handles the `onSubmit` event of forms.
     *
     * @param values
     */
    const handleSubmit = (values: Map<string, string | string[]>): void => {

        const data = {
            Operations: [],
            schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"]
        };

        let operation = {
            op: "replace",
            value: {}
        };

        profileSchema.forEach((schema: ProfileSchema) => {
            let opValue = {};

            const schemaNames = schema.name.split(".");

            if (schema.name !== "roles.default") {
                if (values.get(schema.name) !== undefined && values.get(schema.name).toString() !== undefined) {
                    if (schemaNames.length === 1) {
                        opValue = schemaNames[0] === "emails"
                            ? { emails: [values.get(schema.name)] }
                            : { [schemaNames[0]]: values.get(schemaNames[0]) };
                    } else {
                        if (schemaNames[0] === "name") {
                            const name = values.get(schema.name) && (
                                opValue = {
                                    name: { [schemaNames[1]]: values.get(schema.name) }
                                }
                            );
                        } else {
                            opValue = {
                                [schemaNames[0]]: [
                                    {
                                        type: schemaNames[1],
                                        value: values.get(schema.name)
                                    }
                                ]
                            };
                        }
                    }
                }
            }

            operation = {
                op: "replace",
                value: opValue
            };
            data.Operations.push(operation);
        });

        updateUserInfo(user.id, data).then(() => {
            onAlertFired({
                    description: t(
                        "devPortal:components.user.profile.notifications.updateProfileInfo.success.description"
                    ),
                    level: AlertLevels.SUCCESS,
                    message: t(
                        "devPortal:components.user.profile.notifications.updateProfileInfo.success.message"
                    )
                });
            handleUserUpdate(user.id);
        });
    };

    /**
     * This function generates the user profile details form based on the input Profile Schema
     *
     * @param {Profile Schema} schema
     * @param {number} key
     */
    const generateProfileEditForm = (schema: ProfileSchema, key: number): JSX.Element => {
        const fieldName = t("devPortal:components.user.profile.fields." +
            schema.name.replace(".", "_"), { defaultValue: schema.displayName }
        );

        const domainName = profileInfo?.get(schema.name)?.toString().split("/");

        return (
            <Grid.Row columns={ 1 }>
                <Grid.Column mobile={ 12 } tablet={ 12 } computer={ 6 }>
                    {
                        schema.name === "userName" && domainName.length > 1 ? (
                            <Form.Field>
                                <label>
                                    { fieldName }
                                </label>
                                <Input
                                    data-testid={ `${ testId }-profile-form-${ schema.name }-input` }
                                    name={ schema.name }
                                    label={ domainName[0] + " / " }
                                    required={ schema.required }
                                    requiredErrorMessage={ fieldName + " " + "is required" }
                                    placeholder={ "Enter your" + " " + fieldName }
                                    type="text"
                                    value={ domainName[1] }
                                    key={ key }
                                />
                            </Form.Field>
                        ) : (
                            <Field
                                data-testid={ `${ testId }-profile-form-${ schema.name }-input` }
                                name={ schema.name }
                                label={ schema.name === "profileUrl" ? "Profile Image URL" : fieldName }
                                required={ schema.required }
                                requiredErrorMessage={ fieldName + " " + "is required" }
                                placeholder={ "Enter your" + " " + fieldName }
                                type="text"
                                value={ profileInfo.get(schema.name) }
                                key={ key }
                            />
                        )
                    }
                </Grid.Column>
            </Grid.Row>
        );
    };

    return (
        <>
            {
                !_.isEmpty(profileInfo) && (
                    <Forms
                        data-testid={ `${ testId }-form` }
                        onSubmit={ (values) => handleSubmit(values) }
                    >
                        <Grid>
                            {
                                profileSchema && profileSchema.map((schema: ProfileSchema, index: number) => {
                                    if (schema.name !== "roles.default") {
                                        return (
                                            generateProfileEditForm(schema, index)
                                        );
                                    }
                                })
                            }
                            <Grid.Row columns={ 1 }>
                                <Grid.Column mobile={ 16 } tablet={ 16 } computer={ 8 }>
                                    <Button
                                        data-testid={ `${ testId }-form-update-button` }
                                        primary
                                        type="submit"
                                        size="small"
                                        className="form-button"
                                    >
                                        Update
                                    </Button>
                                </Grid.Column>
                            </Grid.Row>
                        </Grid>
                    </Forms>
                )
            }
            <Divider hidden />
            <DangerZoneGroup sectionHeader={ t("devPortal:components.user.editUser.dangerZoneGroup.header") }>
                <DangerZone
                    data-testid={ `${ testId }-danger-zone` }
                    actionTitle={ t("devPortal:components.user.editUser.dangerZoneGroup.dangerZone.actionTitle") }
                    header={ t("devPortal:components.user.editUser.dangerZoneGroup.dangerZone.header") }
                    subheader={ t("devPortal:components.user.editUser.dangerZoneGroup.dangerZone.subheader") }
                    onActionClick={ (): void => {
                        setShowDeleteConfirmationModal(true);
                        setDeletingUser(user);
                    } }
                />
            </DangerZoneGroup>
            {
                deletingUser && (
                    <ConfirmationModal
                        data-testid={ `${ testId }-confirmation-modal` }
                        onClose={ (): void => setShowDeleteConfirmationModal(false) }
                        type="warning"
                        open={ showDeleteConfirmationModal }
                        assertion={ deletingUser.userName }
                        assertionHint={ <p>Please type <strong>{ deletingUser.userName }</strong> to confirm.</p> }
                        assertionType="input"
                        primaryAction={ t("common:confirm") }
                        secondaryAction={ t("common:cancel") }
                        onSecondaryActionClick={ (): void => setShowDeleteConfirmationModal(false) }
                        onPrimaryActionClick={ (): void => handleUserDelete(deletingUser.id) }
                    >
                        <ConfirmationModal.Header data-testid={ `${ testId }-confirmation-modal-header` }>
                            { t("devPortal:components.user.deleteUser.confirmationModal.header") }
                        </ConfirmationModal.Header>
                        <ConfirmationModal.Message
                            data-testid={ `${ testId }-confirmation-modal-message` }
                            attached
                            warning
                         >
                            { t("devPortal:components.user.deleteUser.confirmationModal.message") }
                        </ConfirmationModal.Message>
                        <ConfirmationModal.Content>
                            { t("devPortal:components.user.deleteUser.confirmationModal.content") }
                        </ConfirmationModal.Content>
                    </ConfirmationModal>
                )
            }
        </>
    );
};

/**
 * User profile component default props.
 */
UserProfile.defaultProps = {
    "data-testid": "user-mgt-user-profile"
};