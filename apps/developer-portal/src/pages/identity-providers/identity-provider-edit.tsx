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
 * under the License.
 */

import { getRawDocumentation } from "@wso2is/core/api";
import { AlertLevels, TestableComponentInterface } from "@wso2is/core/models";
import { addAlert } from "@wso2is/core/store";
import { StringUtils } from "@wso2is/core/utils";
import {
    AppAvatar,
    ContentLoader,
    HelpPanelLayout,
    HelpPanelTabInterface,
    Markdown,
    PageLayout
} from "@wso2is/react-components";
import _ from "lodash";
import React, { FunctionComponent, ReactElement, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { SemanticICONS } from "semantic-ui-react";
import { getIdentityProviderDetail } from "../../api";
import { EditIdentityProvider } from "../../components";
import { HelpSidebarIcons } from "../../configs";
import { IdentityProviderConstants, IdentityProviderManagementConstants } from "../../constants";
import { history } from "../../helpers";
import {
    ConfigReducerStateInterface,
    IdentityProviderInterface,
    PortalDocumentationStructureInterface,
    emptyIdentityProvider
} from "../../models";
import { AppState } from "../../store";
import { setHelpPanelDocsContentURL } from "../../store/actions";
import { HelpPanelUtils } from "../../utils";

/**
 * Proptypes for the IDP edit page component.
 */
type IDPEditPagePropsInterface = TestableComponentInterface

/**
 * Identity Provider Edit page.
 * 
 * @param {IDPEditPagePropsInterface} props - Props injected to the component.
 * @return {React.ReactElement}
 */
export const IdentityProviderEditPage: FunctionComponent<IDPEditPagePropsInterface> = (
    props: IDPEditPagePropsInterface
): ReactElement => {

    const {
        [ "data-testid" ]: testId
    } = props;

    const dispatch = useDispatch();
    const { t } = useTranslation();

    const config: ConfigReducerStateInterface = useSelector((state: AppState) => state.config);
    const helpPanelDocURL: string = useSelector((state: AppState) => state.helpPanel.docURL);
    const helpPanelDocStructure: PortalDocumentationStructureInterface = useSelector(
        (state: AppState) => state.helpPanel.docStructure);

    const [ identityProvider, setIdentityProvider ] = useState<IdentityProviderInterface>(emptyIdentityProvider);
    const [ isIdentityProviderRequestLoading, setIdentityProviderRequestLoading ] = useState<boolean>(false);
    const [ helpPanelDocContent, setHelpPanelDocContent ] = useState<string>(undefined);
    const [
        isHelpPanelDocContentRequestLoading,
        setHelpPanelDocContentRequestLoadingStatus
    ] = useState<boolean>(false);

    /**
     * Set the default doc content URL for the tab.
     */
    useEffect(() => {
        if (_.isEmpty(helpPanelDocStructure)) {
            return;
        }

        const overviewDocs = _.get(helpPanelDocStructure,
            IdentityProviderManagementConstants.IDP_EDIT_OVERVIEW_DOCS_KEY);

        if (!overviewDocs) {
            return;
        }

        dispatch(setHelpPanelDocsContentURL(overviewDocs));
    }, [ helpPanelDocStructure, dispatch ]);

    /**
     * Called when help panel doc URL status changes.
     */
    useEffect(() => {
        if (!helpPanelDocURL) {
            return;
        }

        setHelpPanelDocContentRequestLoadingStatus(true);

        getRawDocumentation<string>(
            config.endpoints.documentationContent,
            helpPanelDocURL,
            config.deployment.documentation.provider,
            config.deployment.documentation.githubOptions.branch)
            .then((response) => {
                setHelpPanelDocContent(response);
            })
            .finally(() => {
                setHelpPanelDocContentRequestLoadingStatus(false);
            });
    }, [
        helpPanelDocURL,
        config.deployment.documentation.githubOptions.branch,
        config.deployment.documentation.provider,
        config.endpoints.documentationContent
    ]);

    /**
     * Retrieves idp details from the API.
     *
     * @param {string} id - IDP id.
     */
    const getIdentityProvider = (id: string): void => {
        setIdentityProviderRequestLoading(true);

        getIdentityProviderDetail(id)
            .then((response) => {
                setIdentityProvider(response);
            })
            .catch((error) => {
                if (error.response && error.response.data && error.response.data.description) {
                    dispatch(addAlert({
                        description: t("devPortal:components.idp.notifications.getIDP.error.description",
                            { description: error.response.data.description }),
                        level: AlertLevels.ERROR,
                        message: t("devPortal:components.idp.notifications.getIDP.error.message")
                    }));

                    return;
                }

                dispatch(addAlert({
                    description: t("devPortal:components.idp.notifications.getIDP.genericError.description"),
                    level: AlertLevels.ERROR,
                    message: t("devPortal:components.idp.notifications.getIDP.genericError.message")
                }));
            })
            .finally(() => {
                setIdentityProviderRequestLoading(false);
            });
    };

    /**
     * Handles the back button click event.
     */
    const handleBackButtonClick = (): void => {
        history.push(IdentityProviderConstants.PATHS.get("IDENTITY_PROVIDERS"));
    };

    /**
     * Called when an idp is deleted.
     */
    const handleIdentityProviderDelete = (): void => {
        history.push(IdentityProviderConstants.PATHS.get("IDENTITY_PROVIDERS"));
    };

    /**
     * Called when an idp updates.
     *
     * @param {string} id - IDP id.
     */
    const handleIdentityProviderUpdate = (id: string): void => {
        getIdentityProvider(id);
    };

    /**
     * Use effect for the initial component load.
     */
    useEffect(() => {
        const path = history.location.pathname.split("/");
        const id = path[ path.length - 1 ];

        getIdentityProvider(id);
    }, []);

    const helpPanelTabs: HelpPanelTabInterface[] = [
        {
            content: (
                isHelpPanelDocContentRequestLoading
                    ? <ContentLoader dimmer/>
                    : (
                        <Markdown
                            source={ helpPanelDocContent }
                            transformImageUri={ (uri) =>
                                uri.startsWith("http" || "https")
                                    ? uri
                                    : config.deployment.documentation?.imagePrefixURL + "/"
                                        + StringUtils.removeDotsAndSlashesFromRelativePath(uri)
                            }
                            data-testid={ `${ testId }-help-panel-docs-tab-markdown-renderer` }
                        />
                    )
            ),
            heading: t("common:docs"),
            hidden: !helpPanelDocURL,
            icon: "file alternate outline" as SemanticICONS
        }
    ];

    return (
        <HelpPanelLayout
            sidebarDirection="right"
            sidebarMiniEnabled={ true }
            tabs={ helpPanelTabs }
            onHelpPanelPinToggle={ () => HelpPanelUtils.togglePanelPin() }
            isPinned={ HelpPanelUtils.isPanelPinned() }
            icons={ HelpSidebarIcons.actionPanel }
        >
            <PageLayout
                isLoading={ isIdentityProviderRequestLoading }
                title={ identityProvider.name }
                contentTopMargin={ true }
                description={ identityProvider.description }
                image={ (
                    <AppAvatar
                        name={ identityProvider.name }
                        image={ identityProvider.image }
                        size="tiny"
                        spaced="right"
                    />
                ) }
                backButton={ {
                    onClick: handleBackButtonClick,
                    text: t("devPortal:pages.idpTemplate.backButton")
                } }
                titleTextAlign="left"
                bottomMargin={ false }
                data-testid={ `${ testId }-page-layout` }
            >
                <EditIdentityProvider
                    identityProvider={ identityProvider }
                    isLoading={ isIdentityProviderRequestLoading }
                    onDelete={ handleIdentityProviderDelete }
                    onUpdate={ handleIdentityProviderUpdate }
                    data-testid={ testId }
                />
            </PageLayout>
        </HelpPanelLayout>
    );
};

/**
 * Default proptypes for the IDP edit page component.
 */
IdentityProviderEditPage.defaultProps = {
    "data-testid": "idp-edit-page"
};